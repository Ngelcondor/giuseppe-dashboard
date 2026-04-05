"""Routine and habit tracking models."""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Enum as SQLEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum

from app.core.database import Base


class TimeOfDay(str, Enum):
    """Time of day categories."""

    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"


class Routine(Base):
    """Daily routines (morning routine, evening routine, etc.)."""

    __tablename__ = "routines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    time_of_day = Column(SQLEnum(TimeOfDay), nullable=False)

    is_active = Column(Boolean, default=True, index=True)
    order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    steps = relationship("RoutineStep", back_populates="routine", cascade="all, delete-orphan")
    logs = relationship("RoutineLog", back_populates="routine", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Routine(id={self.id}, name={self.name}, time_of_day={self.time_of_day})>"


class RoutineStep(Base):
    """Steps within a routine."""

    __tablename__ = "routine_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(
        UUID(as_uuid=True), ForeignKey("routines.id"), nullable=False, index=True
    )

    title = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    is_optional = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    icon = Column(String(50), nullable=True)  # emoji or icon name

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    routine = relationship("Routine", back_populates="steps")

    def __repr__(self) -> str:
        return f"<RoutineStep(id={self.id}, title={self.title})>"


class RoutineLog(Base):
    """Log of routine completion."""

    __tablename__ = "routine_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(
        UUID(as_uuid=True), ForeignKey("routines.id"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    completed_steps = Column(JSON, default=[])  # List of completed step IDs
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(String(1000), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    routine = relationship("Routine", back_populates="logs")

    def __repr__(self) -> str:
        return f"<RoutineLog(id={self.id}, routine_id={self.routine_id})>"
