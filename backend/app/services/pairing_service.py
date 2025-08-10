# convolute_app/app/services/pairing_service.py

import json
from collections import deque
from ..models import Student, Pairing, Session, Instructor
from ..extensions import db


class PairingService:
    
    @staticmethod
    def create_pairings(session_keyword):
        """
        Create pairings using advanced round-robin algorithm with role balancing
        """
        session = Session.query.filter_by(keyword=session_keyword).first()
        if not session:
            raise ValueError("Session not found")
        
        # Get current students in session
        students = Student.query.filter_by(session_id=session.id).order_by(Student.join_order).all()
        student_ids = [student.id for student in students]
        
        # Get instructor participation setting
        instructor = Instructor.query.get(session.instructor_id)
        instructor_participates = instructor.participating if instructor else False
        
        # Determine next round number
        latest_pairing = Pairing.query.filter_by(session_id=session.id).order_by(Pairing.round_number.desc()).first()
        next_round = 1 if not latest_pairing else latest_pairing.round_number + 1
        
        # Generate pairings using advanced algorithm
        pairings_result = PairingService._advanced_pair(
            session, student_ids, instructor_participates, next_round
        )
        
        if pairings_result == -1:
            raise ValueError("Not enough students to create pairings")
        
        # Save pairings to database
        pairing_record = Pairing(
            session_id=session.id,
            round_number=next_round,
            pairs=json.dumps(pairings_result['pairs'])
        )
        db.session.add(pairing_record)
        
        # Update student round counts and role tracking
        PairingService._update_student_history(session, pairings_result['pairs'])
        
        # Save updated round-robin state
        session.prev_pairing_ids = json.dumps(pairings_result['next_state'])
        
        db.session.commit()
        
        return {
            'round_number': next_round,
            'pairs': pairings_result['pairs'],
            'instructor_paired': pairings_result.get('instructor_paired', False),
            'student_sitting_out': pairings_result.get('student_sitting_out', None)
        }
    
    @staticmethod
    def _advanced_pair(session, student_ids, instructor_participates, round_number):
        """
        Advanced pairing algorithm adapted from the provided Round class
        """
        if len(student_ids) < 2:
            return -1
        
        # Handle odd number of students
        student_sitting_out = None
        instructor_paired = False
        working_ids = student_ids.copy()
        
        if len(working_ids) % 2 != 0:
            if instructor_participates:
                # Add instructor (use negative ID to distinguish from students)
                working_ids.append(-session.instructor_id)
                instructor_paired = True
            else:
                # Remove student with most rounds (senior takes break)
                students = Student.query.filter(Student.id.in_(working_ids)).all()
                senior_student = max(students, key=lambda s: s.round_count)
                working_ids.remove(senior_student.id)
                student_sitting_out = senior_student.id
        
        # Get or initialize round-robin state
        prev_pairing_ids = json.loads(session.prev_pairing_ids) if session.prev_pairing_ids else []
        
        # Initialize or update the round-robin sequence
        if not prev_pairing_ids or set(prev_pairing_ids) != set(working_ids):
            # Reset round-robin state with current students
            if instructor_participates and -session.instructor_id in working_ids:
                # Put instructor first (like dummy student) so students paired with instructor take breaks by seniority
                non_instructor_ids = [id for id in working_ids if id != -session.instructor_id]
                # Sort by join_order (reverse for seniority)
                students = Student.query.filter(Student.id.in_(non_instructor_ids)).order_by(Student.join_order.desc()).all()
                prev_pairing_ids = [-session.instructor_id] + [s.id for s in students]
            else:
                # Normal initialization by join order
                students = Student.query.filter(Student.id.in_(working_ids)).order_by(Student.join_order).all()
                prev_pairing_ids = [s.id for s in students]
        
        student_count = len(working_ids)
        
        # Create pairs using circle method
        pre_pairings = []
        for i in range(student_count // 2):
            id1 = prev_pairing_ids[i]
            id2 = prev_pairing_ids[student_count - 1 - i]
            pre_pairings.append((id1, id2))
        
        # Assign roles based on previous interactions
        final_pairings = PairingService._assign_roles(session, pre_pairings)
        
        # Rotate for next round (all but first element)
        next_state = ([prev_pairing_ids[0]] + 
                     [prev_pairing_ids[-1]] + 
                     prev_pairing_ids[1:-1])
        
        return {
            'pairs': final_pairings,
            'next_state': next_state,
            'instructor_paired': instructor_paired,
            'student_sitting_out': student_sitting_out
        }
    
    @staticmethod
    def _assign_roles(session, pre_pairings):
        """
        Assign leader/follower roles based on previous interactions
        """
        final_pairings = []
        
        for id1, id2 in pre_pairings:
            # Skip if either is instructor (negative ID)
            if id1 < 0 or id2 < 0:
                # Instructor is always second (follower role)
                if id1 < 0:
                    final_pairings.append([id2, id1])
                else:
                    final_pairings.append([id1, id2])
                continue
            
            # Get students and their interaction history
            student1 = Student.query.get(id1)
            student2 = Student.query.get(id2)
            
            if not student1 or not student2:
                final_pairings.append([id1, id2])
                continue
            
            has_led_1 = json.loads(student1.has_led) if student1.has_led else {}
            has_led_2 = json.loads(student2.has_led) if student2.has_led else {}
            
            # Compare how many times each has led the other
            led_count_1_to_2 = has_led_1.get(str(id2), 0)
            led_count_2_to_1 = has_led_2.get(str(id1), 0)
            
            # If student1 has led student2 more, let student2 lead this time
            if led_count_1_to_2 > led_count_2_to_1:
                final_pairings.append([id2, id1])  # student2 leads
            else:
                final_pairings.append([id1, id2])  # student1 leads
        
        return final_pairings
    
    @staticmethod
    def _update_student_history(session, pairings):
        """
        Update students' interaction history and round counts
        """
        participating_ids = set()
        
        for pair in pairings:
            leader_id, follower_id = pair[0], pair[1]
            
            # Skip instructor updates (negative IDs)
            if leader_id > 0:
                participating_ids.add(leader_id)
            if follower_id > 0:
                participating_ids.add(follower_id)
            
            # Update leader's history (only for real students)
            if leader_id > 0 and follower_id > 0:
                leader = Student.query.get(leader_id)
                if leader:
                    has_led = json.loads(leader.has_led) if leader.has_led else {}
                    has_led[str(follower_id)] = has_led.get(str(follower_id), 0) + 1
                    leader.has_led = json.dumps(has_led)
        
        # Update round counts for participating students
        participating_students = Student.query.filter(Student.id.in_(participating_ids)).all()
        for student in participating_students:
            student.round_count += 1
        
        db.session.flush()
    
    @staticmethod
    def get_session_pairings(session_keyword):
        """Get all pairings for a session"""
        session = Session.query.filter_by(keyword=session_keyword).first()
        if not session:
            return []
            
        pairings = Pairing.query.filter_by(session_id=session.id).order_by(Pairing.round_number).all()
        
        result = []
        for pairing in pairings:
            pairs_data = json.loads(pairing.pairs)
            result.append({
                'round_number': pairing.round_number,
                'pairs': pairs_data
            })
            
        return result
