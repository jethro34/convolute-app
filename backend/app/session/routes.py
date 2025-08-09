# convolute_app/app/session/routes.py

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from jwt.exceptions import DecodeError
from ..models import Session, Instructor, Student
from ..extensions import db
from ..services.keyword_service import KeywordService
from ..socket_events.events import notify_student_joined, notify_student_left, notify_student_removed
from . import session_bp


@session_bp.route('/create', methods=['POST'])
def create_session():
    # Try to get user ID, fall back to guest instructor (ID 0) for guest sessions
    current_user_id = 0  # Default to guest instructor
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
    except:
        # Guest session - use guest instructor ID
        current_user_id = 0
        # Ensure guest instructor exists
        guest_instructor = Instructor.query.filter_by(id=0).first()
        if not guest_instructor:
            guest_instructor = Instructor(id=0, email='guest@system', password='')
            db.session.add(guest_instructor)
            db.session.commit()

    # Get next keyword from circular buffer
    keyword = KeywordService.get_next_keyword()
    
    # Ensure keyword is unique in sessions (though it should be with our approach)
    counter = 1
    original_keyword = keyword
    while Session.query.filter_by(keyword=keyword).first():
        keyword = f"{original_keyword}{counter}"
        counter += 1

    # Create new session (instructor_id can be None for guest sessions)
    session = Session(keyword=keyword, instructor_id=current_user_id)
    db.session.add(session)
    db.session.commit()

    return jsonify({
        'session_id': session.id,
        'keyword': session.keyword,
        'message': 'Session created successfully'
    }), 201


@session_bp.route('/list', methods=['GET'])
@jwt_required()
def list_sessions():
    current_user_id = get_jwt_identity()
    sessions = Session.query.filter_by(instructor_id=current_user_id).all()

    session_list = []
    for session in sessions:
        session_list.append({
            'id': session.id,
            'keyword': session.keyword
        })

    return jsonify({'sessions': session_list}), 200


@session_bp.route('/<keyword>', methods=['GET'])
def get_session(keyword):
    session = Session.query.filter_by(keyword=keyword).first()

    if not session:
        return jsonify({'message': 'Session not found'}), 404

    return jsonify({
        'id': session.id,
        'keyword': session.keyword,
        'instructor_id': session.instructor_id
    }), 200


@session_bp.route('/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_session(session_id):
    current_user_id = get_jwt_identity()
    session = Session.query.filter_by(id=session_id, instructor_id=current_user_id).first()

    if not session:
        return jsonify({'message': 'Session not found'}), 404

    db.session.delete(session)
    db.session.commit()

    return jsonify({'message': 'Session deleted successfully'}), 200


@session_bp.route('/keywords/populate', methods=['POST'])
def populate_keywords():
    """Populate the keywords table with initial words"""
    result = KeywordService.populate_keywords()
    return jsonify(result), 200


@session_bp.route('/keywords/stats', methods=['GET'])
def keyword_stats():
    """Get keyword usage statistics"""
    stats = KeywordService.get_keyword_stats()
    return jsonify(stats), 200


@session_bp.route('/keywords/next', methods=['GET'])
def get_next_keyword():
    """Get the next keyword (for testing purposes)"""
    keyword = KeywordService.get_next_keyword()
    return jsonify({'keyword': keyword}), 200


@session_bp.route('/<keyword>/students', methods=['POST'])
def add_student(keyword):
    """Add a student to a session"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({'message': 'Student name is required'}), 400
    
    student_name = data['name'].strip()
    if not student_name:
        return jsonify({'message': 'Student name cannot be empty'}), 400
    
    # Find the session
    session = Session.query.filter_by(keyword=keyword).first()
    if not session:
        return jsonify({'message': 'Session not found'}), 404
    
    # Check if student already exists in this session
    existing_student = Student.query.filter_by(name=student_name, session_id=session.id).first()
    if existing_student:
        return jsonify({'message': 'Student already exists in this session'}), 409
    
    # Add the student
    student = Student(name=student_name, session_id=session.id)
    db.session.add(student)
    
    # Increment student count
    session.student_count += 1
    
    db.session.commit()
    
    # Notify instructors via WebSocket
    student_data = {
        'id': student.id,
        'name': student.name,
        'joined_at': student.joined_at.isoformat()
    }
    notify_student_joined(keyword, student_data)
    
    return jsonify({
        'id': student.id,
        'name': student.name,
        'joined_at': student.joined_at.isoformat(),
        'message': 'Student added successfully'
    }), 201


@session_bp.route('/<keyword>/students', methods=['GET'])
def list_students(keyword):
    """Get all students in a session"""
    session = Session.query.filter_by(keyword=keyword).first()
    if not session:
        return jsonify({'message': 'Session not found'}), 404
    
    students = Student.query.filter_by(session_id=session.id).all()
    
    student_list = []
    for student in students:
        student_list.append({
            'id': student.id,
            'name': student.name,
            'joined_at': student.joined_at.isoformat()
        })
    
    return jsonify({'students': student_list}), 200


@session_bp.route('/<keyword>/students/<int:student_id>', methods=['DELETE'])
def remove_student(keyword, student_id):
    """Remove a student from a session"""
    session = Session.query.filter_by(keyword=keyword).first()
    if not session:
        return jsonify({'message': 'Session not found'}), 404
    
    student = Student.query.filter_by(id=student_id, session_id=session.id).first()
    if not student:
        return jsonify({'message': 'Student not found in this session'}), 404
    
    # Store student data before deletion for WebSocket notification
    student_data = {
        'id': student.id,
        'name': student.name,
        'joined_at': student.joined_at.isoformat()
    }
    
    # Notify student they were removed (before deletion)
    notify_student_removed(keyword, student.name, "removed by instructor")
    
    db.session.delete(student)
    db.session.commit()
    
    # Notify instructors via WebSocket
    notify_student_left(keyword, student_data)
    
    return jsonify({'message': 'Student removed successfully'}), 200


@session_bp.route('/<keyword>/students/<student_name>/leave', methods=['DELETE'])
def student_leave_session(keyword, student_name):
    """Student leaves session voluntarily"""
    session = Session.query.filter_by(keyword=keyword).first()
    if not session:
        return jsonify({'message': 'Session not found'}), 404
    
    student = Student.query.filter_by(name=student_name, session_id=session.id).first()
    if not student:
        return jsonify({'message': 'Student not found in this session'}), 404
    
    # Store student data before deletion for WebSocket notification
    student_data = {
        'id': student.id,
        'name': student.name,
        'joined_at': student.joined_at.isoformat()
    }
    
    db.session.delete(student)
    db.session.commit()
    
    # Notify instructors via WebSocket
    notify_student_left(keyword, student_data)
    
    return jsonify({'message': 'Successfully left session'}), 200


@session_bp.route('/<keyword>/end', methods=['POST'])
def end_session(keyword):
    """End a session"""
    session = Session.query.filter_by(keyword=keyword).first()
    if not session:
        return jsonify({'message': 'Session not found'}), 404
    
    # Set end time
    session.end_time = db.func.current_timestamp()
    
    # Get all students before cleanup
    students = Student.query.filter_by(session_id=session.id).all()
    
    # Remove all students from session
    for student in students:
        db.session.delete(student)
    
    db.session.commit()
    
    # Notify all students that session ended
    from ..socket_events.events import notify_session_ended
    notify_session_ended(keyword)
    
    return jsonify({
        'message': 'Session ended successfully',
        'students_removed': len(students)
    }), 200
