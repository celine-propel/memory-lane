# models.py
from datetime import datetime, date
from yourapp import db

class AssessmentResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)
    test_id = db.Column(db.String(64), nullable=False)  # stroop, trails, puzzle, fluency
    score = db.Column(db.Float, nullable=False)
    metrics_json = db.Column(db.JSON, nullable=False, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Schedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    num_days = db.Column(db.Integer, nullable=False)
    schedule_json = db.Column(db.JSON, nullable=False, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ScheduleCompletion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)
    schedule_id = db.Column(db.Integer, index=True, nullable=False)
    date = db.Column(db.Date, nullable=False)
    game_id = db.Column(db.String(64), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "schedule_id", "date", "game_id", name="uniq_completion"),
    )
