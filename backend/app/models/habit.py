"""Habit tracking models."""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Date, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, date
from enum import Enum

from app.core.database import Base


class HabitFrequency(str, Enum):
    """Habit frequency."""

    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class Habit(Base):
    """Habit tracking."""

    __tablename__ = "habits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=True)
    frequency = Column(SQLEnum(HabitFrequency), default=HabitFrequency.DAILY)

    # Target (e.g., "exercise 30 min", "drink 8 glasses of water")
    target_per_period = Column(Integer, default=1)
    unit = Column(String(50), nullable=True)  # minutes, glasses, pages, etc.

    # Display
    color = Column(String(7), default="#10B981")  # hex color
    icon = Column(String(50), nullable=True)  # emoji or icon name

    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Habit(id={self.id}, name={self.name}, frequency={self.frequency})>"


class HabitLog(Base):
    """Log of habit completion."""

    __tablename__ = "habit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_id = Column(
        UUID(as_uuid=True), ForeignKey("habits.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    date = Column(Date, nullable=False, index=True)
    completed = Column(Boolean, default=False)
    value = Column(Float, nullable=True)  # e.g., minutes exercised, glasses drunk
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    habit = relationship("Habit", back_populates="logs")

    def __repr__(self) -> str:
        return f"<HabitLog(id={self.id}, habit_id={self.habit_id}, date={self.date})>"
