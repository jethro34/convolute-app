# convolute/backend/app/__init__.py

import os
from flask import Flask
from flask_cors import CORS
from .extensions import db, jwt, socketio
from .config import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    
    # Dynamic CORS origins for production and development
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    
    CORS(app, resources={
        r"/api/*": {"origins": cors_origins}
    })
    socketio.init_app(app, cors_allowed_origins=cors_origins)

    # Import blueprints here to avoid circular imports
    from .auth import auth_bp
    from .session import session_bp

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(session_bp, url_prefix='/api/session')

    # Register Socket.IO events
    from .socket_events.events import register_socket_events
    register_socket_events(socketio)

    # Create tables
    with app.app_context():
        db.create_all()

    return app
