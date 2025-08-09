# convolute/backend/app/auth/routes.py

from flask import request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
from ..models import Instructor
from ..extensions import db
from . import auth_bp


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400

    instructor = Instructor.query.filter_by(email=email).first()

    if instructor and check_password_hash(instructor.password, password):
        access_token = create_access_token(identity=instructor.id)
        return jsonify({'access_token': access_token}), 200

    return jsonify({'message': 'Invalid credentials'}), 401


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400

    # Check if instructor already exists
    if Instructor.query.filter_by(email=email).first():
        return jsonify({'message': 'Email already registered'}), 400

    # Create new instructor
    hashed_password = generate_password_hash(password)
    instructor = Instructor(email=email, password=hashed_password)

    db.session.add(instructor)
    db.session.commit()

    access_token = create_access_token(identity=instructor.id)
    return jsonify({'access_token': access_token, 'message': 'Registration successful'}), 201


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    instructor = Instructor.query.get(current_user_id)

    if not instructor:
        return jsonify({'message': 'User not found'}), 404

    return jsonify({
        'id': instructor.id,
        'email': instructor.email
    }), 200
