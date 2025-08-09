# monolith_app/app/__main__.py

from . import create_app
from .extensions import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True)
