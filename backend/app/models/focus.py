"""Focus and productivity tracking models."""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from app.core.database import Base


class PomodoroSession(Base):
    """Pomodoro session tracking."""

    __tablename__ = "pomodoro_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    task_name = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, default=25)
    break_duration = Column(Integer, default=5)

    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    completed = Column(Boolean, default=False)

    category = Column(String(100), nullable=True)
    notes = Column(String(1000), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PomodoroSession(id={self.id}, task_name={self.task_name})>"


class FocusScore(Base):
    """Daily focus score calculated from health metrics and productivity data."""

    __tablename__ = "focus_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    date = Column(Date, nullable=False, index=True)

    # Score (0-100)
    score = Column(Float, nullable=False)

    # Contributing factors
    sleep_quality = Column(Float, nullable=True)  # 0-10 scale
    resting_hr = Column(Float, nullable=True)  # beats per minute
    focus_hours = Column(Float, nullable=True)  # hours in focused sessions
    exercise_minutes = Column(Integer, nullable=True)

    # Additional context
    notes = Column(String(1000), nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<FocusScore(id={self.id}, date={self.date}, score={self.score})>"
