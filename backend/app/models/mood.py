"""Mood and sensory tracking models."""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from app.core.database import Base


class MoodLog(Base):
    """No-auth mood log — one entry per session, no user FK."""

    __tablename__ = "mood_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 1-5 scales
    mood = Column(Integer, nullable=False)       # 1=😫  5=😄
    energy = Column(Integer, nullable=False)     # 1=💤  5=⚡
    anxiety = Column(Integer, nullable=False)    # 1=😌  5=😰
    stimming = Column(Integer, default=1)        # 1=nessuno  5=intenso

    notes = Column(String(1000), nullable=True)
    tags = Column(JSON, default=list)            # list[str]

    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    log_date = Column(Date, default=date.today, nullable=False, index=True)


class MoodEntry(Base):
    """Daily mood tracking."""

    __tablename__ = "mood_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Mood scales (1-10)
    mood_level = Column(Integer, nullable=False)  # 1=very bad, 10=very good
    energy_level = Column(Integer, nullable=False)  # 1=exhausted, 10=energetic
    anxiety_level = Column(Integer, nullable=False)  # 1=calm, 10=very anxious

    notes = Column(String(1000), nullable=True)
    tags = Column(JSON, default=[])  # e.g., ["stressed", "productive", "social"]

    recorded_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<MoodEntry(id={self.id}, mood_level={self.mood_level})>"


class SensoryLog(Base):
    """Log of sensory sensitivities or overload."""

    __tablename__ = "sensory_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Intensity (1-10)
    intensity = Column(Integer, nullable=False)

    # Context
    trigger = Column(String(255), nullable=False)  # e.g., "loud noise", "bright light"
    environment = Column(String(255), nullable=True)  # where it happened
    coping_strategy = Column(String(500), nullable=True)  # what helped
    duration_minutes = Column(Integer, nullable=True)

    notes = Column(String(1000), nullable=True)
    recorded_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SensoryLog(id={self.id}, intensity={self.intensity})>"
