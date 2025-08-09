# File: monolith_app/app/session/routes.py

import random
import string

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Session

session_bp = Blueprint("session", __name__)


@session_bp.route("/create", methods=["POST"])
@jwt_required()
def create_session():
    instructor_id = get_jwt_identity()
    keyword = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    session = Session(keyword=keyword, instructor_id=instructor_id)
    db.session.add(session)
    db.session.commit()
    return jsonify({"keyword": keyword})
