# convolute/backend/app/models.py

from .extensions import db


class Instructor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(120))
    participating = db.Column(db.Boolean, default=False)


class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(10), unique=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey("instructor.id"))
    start_time = db.Column(db.DateTime, default=db.func.current_timestamp())
    end_time = db.Column(db.DateTime, nullable=True)
    student_count = db.Column(db.Integer, default=0)    # total number of students who have been in session


class Keyword(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(50), unique=True, nullable=False)


class KeywordPointer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    current_index = db.Column(db.Integer, default=0)


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("session.id"))
    round_count = db.Column(db.Integer, default=0)  # rounds student has participated in


class Pairing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("session.id"))
    round_number = db.Column(db.Integer, nullable=False)
    pairing_list = db.Column(db.Text, default='[]')    # JSON string: [student_id1, student_id2, ...]
    rotation = db.Column(db.Text, default='[]')    # JSON string: [student_id1, student_id2, ...]
    pairs = db.Column(db.Text, nullable=False)  # JSON string: [[student_id1, student_id2], [student_id3, student_id4]]
