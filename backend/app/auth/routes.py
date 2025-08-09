# monolith_app/app/auth/routes.py

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from ..models import Instructor

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    instructor = Instructor.query.filter_by(email=data["email"]).first()
    if instructor and instructor.password == data["password"]:
        access_token = create_access_token(identity=instructor.id)
        return jsonify(access_token=access_token)
    return jsonify({"msg": "Bad login"}), 401
