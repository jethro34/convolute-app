# convolute_app/app/services/pairing_service.py

import json
from ..models import Student, Pairing, Session
from ..extensions import db


class PairingService:
    swap_first_pair = False

    @staticmethod
    def create_pairings(session_keyword):
        """
        Create pairings using modified circle method.
        """
        session = Session.query.filter_by(keyword=session_keyword).first()
        if not session:
            raise ValueError("Session not found")
        
        # Get current students in session
        students = Student.query.filter_by(session_id=session.id).order_by(Student.round_count).all()

        # Create pairing_list to generate pairs from
        pairing_list = [student.id for student in students]
        pairing_list_length = len(pairing_list)

        if pairing_list_length < 2:
            raise ValueError("Not enough students to create pairings")

        if pairing_list_length % 2 != 0:
            pairing_list = [0] + pairing_list   # prepend dummy from odd lists

        # Pull most recent pairing entry from Database
        latest_pairing = Pairing.query.filter_by(session_id=session.id).order_by(Pairing.round_number.desc()).first()

        # Determine next round number
        next_round = 1 if not latest_pairing else latest_pairing.round_number + 1

        # Determine rotation based on previous state
        if not latest_pairing or json.loads(latest_pairing.pairing_list) != pairing_list:
            # First round or student list changed - use current pairing_list
            last_rotation = pairing_list
        else:
            # Same student list - rotate from previous
            PairingService.swap_first_pair = not PairingService.swap_first_pair
            prev_rotation = json.loads(latest_pairing.rotation)
            last_rotation = [prev_rotation[0], prev_rotation[-1]] + prev_rotation[1:-1]

        # Generate pairings using modified circle method algorithm
        pairings = PairingService._pair(last_rotation)

        # Save pairings to database
        pairing_record = Pairing(
            session_id=session.id,
            round_number=next_round,
            pairing_list=json.dumps(pairing_list),
            rotation=json.dumps(last_rotation),
            pairs=json.dumps(pairings)
        )
        db.session.add(pairing_record)
        
        # Update student round counts
        for student in students:
            student.round_count += 1

        
        db.session.commit()
        
        return {
            'round_number': next_round,
            'pairs': pairings
        }

    @staticmethod
    def _pair(pairing_list):
        """
        Modified circle method pairing algorithm to generate pairs from even lists.
        """
        pairs = []
        list_len = len(pairing_list)

        for i in range(list_len // 2):
            if i == 0 and PairingService.swap_first_pair:
                pair = pairing_list[list_len - i - 1], pairing_list[i]
            else:
                pair = pairing_list[i], pairing_list[list_len - i - 1]
            pairs.append(pair)
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
