# monolith_app/app/socket_events/events.py

from flask import request
from flask_socketio import emit, join_room
from ..prompts.client import get_random_prompt

sessions = {}

def register_socket_events(socketio):
    # File: monolith_app/app/socket_events/events.py

    @socketio.on("join_session")
    def handle_join(data):
        keyword = data["keyword"]
        username = data.get("username", "Guest")
        sid = request.sid

        join_room(keyword)

        if keyword not in sessions:
            sessions[keyword] = []

        sessions[keyword].append({"sid": sid, "username": username})
        emit("joined", {"sid": sid, "username": username, "count": len(sessions[keyword])}, to=keyword)

    @socketio.on("start_session")
    def handle_start(data):
        keyword = data["keyword"]
        room = sessions.get(keyword, [])

        if len(room) < 2:
            emit("error", {"message": "Not enough students"}, to=request.sid)
            return

        for i in range(0, len(room) - 1, 2):
            s1, s2 = room[i], room[i+1]
            prompt = get_random_prompt()
            emit("prompt", {"role": "asker", "prompt": prompt}, to=s1)
            emit("prompt", {"role": "responder", "prompt": prompt}, to=s2)
