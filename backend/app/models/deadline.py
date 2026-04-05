"""Deadline and task tracking model."""
from sqlalchemy import Column, String, Date, DateTime, Boolean, Integer, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from enum import Enum

from app.core.database import Base


class DeadlineCategory(str, Enum):
    """Deadline categories."""

    UNIVERSITY = "university"
    PERSONAL = "personal"
    WORK = "work"
    CERTIFICATION = "certification"
    CTF = "ctf"
    OTHER = "other"


class DeadlinePriority(str, Enum):
    """Priority levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Deadline(Base):
    """Deadline tracking for coursework, certifications, CTFs, etc."""

    __tablename__ = "deadlines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    title = Column(String(255), nullable=False, index=True)
    description = Column(String(2000), nullable=True)
    due_date = Column(Date, nullable=False, index=True)
    category = Column(SQLEnum(DeadlineCategory), default=DeadlineCategory.PERSONAL)
    priority = Column(SQLEnum(DeadlinePriority), default=DeadlinePriority.MEDIUM)

    # Status
    is_completed = Column(Boolean, default=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    completion_notes = Column(String(500), nullable=True)

    # Reminders
    reminder_days_before = Column(Integer, default=1)

    # Additional info
    notes = Column(String(2000), nullable=True)
    external_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Deadline(id={self.id}, title={self.title}, due_date={self.due_date})>"
