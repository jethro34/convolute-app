# monolith_app/app/socket_events/events.py

from flask import request
from flask_socketio import emit, join_room, leave_room
from ..prompts.client import get_random_prompt
from ..models import Student, Session
from ..extensions import socketio

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
        
        # Also join student-specific room for removal notifications
        student_room = f"student_{keyword}_{username}"
        join_room(student_room)
        print(f"[DEBUG] Student {username} joined room: {student_room}")

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

    @socketio.on("join_instructor_room")
    def handle_instructor_join(data):
        """Instructor joins their session room to receive real-time updates"""
        keyword = data["keyword"]
        sid = request.sid
        
        # Join the instructor room (separate from student room)
        instructor_room = f"instructor_{keyword}"
        print(f"[DEBUG] Instructor {sid} joining room: {instructor_room}")
        join_room(instructor_room)
        
        emit("instructor_joined", {"message": "Connected to session updates"}, to=sid)
        print(f"[DEBUG] Instructor {sid} successfully joined room: {instructor_room}")

    @socketio.on("leave_instructor_room") 
    def handle_instructor_leave(data):
        """Instructor leaves their session room"""
        keyword = data["keyword"]
        instructor_room = f"instructor_{keyword}"
        leave_room(instructor_room)

def notify_student_joined(keyword, student_data):
    """Emit event when student joins session"""
    instructor_room = f"instructor_{keyword}"
    print(f"[DEBUG] Emitting student_joined to room: {instructor_room}")
    print(f"[DEBUG] Student data: {student_data}")
    socketio.emit("student_joined", {
        "student": student_data,
        "message": f"{student_data['name']} joined the session"
    }, room=instructor_room)

def notify_student_left(keyword, student_data):
    """Emit event when student leaves session"""  
    instructor_room = f"instructor_{keyword}"
    socketio.emit("student_left", {
        "student": student_data,
        "message": f"{student_data['name']} left the session"
    }, room=instructor_room)

def notify_student_removed(keyword, student_name, reason="removed by instructor"):
    """Notify specific student they were removed from session"""
    student_room = f"student_{keyword}_{student_name}"
    print(f"[DEBUG] Notifying student removal to room: {student_room}")
    socketio.emit("student_removed", {
        "message": f"You have been {reason}",
        "reason": reason
    }, room=student_room)

def notify_session_ended(keyword):
    """Notify all students that the session has ended"""
    # Notify all students in the main session room
    socketio.emit("session_ended", {
        "message": "Session has been ended by the instructor",
        "keyword": keyword
    }, room=keyword)
    print(f"[DEBUG] Session ended notification sent to room: {keyword}")
