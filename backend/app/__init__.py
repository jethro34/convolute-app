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

    # Create tables and initialize data
    with app.app_context():
        db.create_all()
        
        # Auto-initialize database with data files on first run
        from .services.keyword_service import KeywordService
        from .services.prompt_service import PromptService
        from .models import Keyword, Prompt
        import json
        import glob
        
        # Only populate if empty (first run)
        if Keyword.query.count() == 0:
            print("Initializing keywords...")
            KeywordService.populate_keywords()
        
        if Prompt.query.count() == 0:
            print("Loading prompts from data files...")
            
            # Get all JSON files in the data directory
            data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
            json_files = glob.glob(os.path.join(data_dir, '*.json'))
            
            total_imported = 0
            for json_file in json_files:
                try:
                    print(f"Loading {os.path.basename(json_file)}...")
                    with open(json_file, 'r', encoding='utf-8') as f:
                        prompts_data = json.load(f)
                    
                    # Import prompts from this file
                    stats = PromptService.bulk_import_prompts(prompts_data)
                    total_imported += stats['imported']
                    print(f"  Imported {stats['imported']} prompts from {os.path.basename(json_file)}")
                    
                except Exception as e:
                    print(f"  Error loading {json_file}: {str(e)}")
            
            print(f"Total prompts imported: {total_imported}")

    return app
