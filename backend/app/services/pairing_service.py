# convolute_app/app/services/pairing_service.py

import json
import random
from ..models import Student, Pairing, Session
from ..extensions import db


class PairingService:
    
    @staticmethod
    def create_pairings(session_keyword):
        """
        Create pairings for the next round in a session using round-robin algorithm
        
        Args:
            session_keyword: The session keyword
            
        Returns:
            dict: {
                'round_number': int,
                'pairs': [[student_id1, student_id2], ...],
                'instructor_paired': bool,
                'student_sitting_out': int or None
            }
        """
        session = Session.query.filter_by(keyword=session_keyword).first()
        if not session:
            raise ValueError("Session not found")
            
        # Get instructor participation setting
        from ..models import Instructor
        instructor = Instructor.query.get(session.instructor_id)
        instructor_participates = instructor.participating if instructor else False
            
        # Get all students in the session
        students = Student.query.filter_by(session_id=session.id).all()
        
        # Sort students by round_count DESC (most rounds first, they sit out first)
        students.sort(key=lambda s: s.round_count, reverse=True)
        student_ids = [student.id for student in students]
        
        # Determine next round number
        latest_pairing = Pairing.query.filter_by(session_id=session.id).order_by(Pairing.round_number.desc()).first()
        next_round = 1 if not latest_pairing else latest_pairing.round_number + 1
        
        # Handle odd number of students
        instructor_paired = False
        student_sitting_out = None
        
        if len(student_ids) % 2 == 1:
            if instructor_participates:
                # Add instructor as participant (use instructor_id, not 0)
                student_ids.append(session.instructor_id)
                instructor_paired = True
            else:
                # Student with most rounds sits out (first in sorted list)
                student_sitting_out = student_ids.pop(0)
        
        # Create pairs using round-robin algorithm
        pairs = PairingService._create_round_robin_pairs(student_ids, session.id, next_round)
        
        # Save to database
        pairing_record = Pairing(
            session_id=session.id,
            round_number=next_round,
            pairs=json.dumps(pairs)
        )
        db.session.add(pairing_record)
        
        # Update student round_count (only for students who participate)
        participating_student_ids = set()
        for pair in pairs:
            participating_student_ids.update(pair)
        
        for student in students:
            if student.id in participating_student_ids:
                student.round_count += 1
            
        db.session.commit()
        
        return {
            'round_number': next_round,
            'pairs': pairs,
            'instructor_paired': instructor_paired,
            'student_sitting_out': student_sitting_out
        }
    
    @staticmethod
    def _create_round_robin_pairs(student_ids, session_id, round_number):
        """
        Round-robin pairing algorithm with alternating roles
        
        Args:
            student_ids: List of student IDs to pair (already sorted by round_count)
            session_id: Session ID for history lookup
            round_number: Current round number
            
        Returns:
            list: [[leader_id, talker_id], ...] where roles alternate
        """
        if len(student_ids) < 2:
            return []
            
        # For round-robin, we use a rotating pattern
        # Round 1: [1,2], [3,4], [5,6]...
        # Round 2: [2,3], [4,5], [6,1]... (rotate the list)
        
        n = len(student_ids)
        pairs = []
        
        # Create pairs from the current arrangement
        for i in range(0, n, 2):
            if i + 1 < n:
                # Alternate roles based on round number
                if round_number % 2 == 1:
                    # Odd rounds: first ID is leader
                    leader_id, talker_id = student_ids[i], student_ids[i + 1]
                else:
                    # Even rounds: second ID is leader
                    leader_id, talker_id = student_ids[i + 1], student_ids[i]
                    
                pairs.append([leader_id, talker_id])
                
        return pairs
    
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