# monolith_app/app/models.py

from .extensions import db

class Instructor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(120))

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(10), unique=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey("instructor.id"))
