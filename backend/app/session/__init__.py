# convolute/backend/app/session/__init__.py


from flask import Blueprint

session_bp = Blueprint('session', __name__)

from . import routes
