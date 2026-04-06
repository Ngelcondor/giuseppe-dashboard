"""Health and wellness models."""
from sqlalchemy import (
    Column,
    String,
    Float,
    DateTime,
    Boolean,
    Integer,
    Enum as SQLEnum,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Text
from app.core.database import Base


class SleepPhase(str, Enum):
    """Types of sleep phases."""
    AWAKE = "awake"
    LIGHT = "light"
    DEEP = "deep"
    REM = "rem"


class MetricType(str, Enum):
    """Types of health metrics."""

    HEART_RATE = "heart_rate"
    SLEEP = "sleep"
    WORKOUT = "workout"
    WEIGHT = "weight"
    CALORIES = "calories"
    STEPS = "steps"
    BLOOD_PRESSURE = "blood_pressure"
    OXYGEN = "oxygen"
    TEMPERATURE = "temperature"


class WorkoutType(str, Enum):
    """Types of workouts."""
    RUNNING = "running"
    WALKING = "walking"
    CYCLING = "cycling"
    SWIMMING = "swimming"
    STRENGTH = "strength"
    HIIT = "hiit"
    YOGA = "yoga"
    STRETCHING = "stretching"
    MARTIAL_ARTS = "martial_arts"
    OTHER = "other"


class WorkoutIntensity(str, Enum):
    """Workout intensity levels."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    EXTREME = "extreme"


class HealthMetric(Base):
    """Health metric tracking (heart rate, sleep, steps, etc.)."""

    __tablename__ = "health_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    metric_type = Column(SQLEnum(MetricType), nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)  # bpm, hours, steps, kg, etc.
    recorded_at = Column(DateTime, nullable=False, index=True)
    source = Column(String(100), nullable=False)  # apple_watch, manual, etc.

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<HealthMetric(id={self.id}, metric_type={self.metric_type}, value={self.value})>"


class Medication(Base):
    """Medication tracking."""

    __tablename__ = "medications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)  # daily, twice daily, etc.
    time_of_day = Column(String(100), nullable=False)  # morning, evening, etc.
    scheduled_time = Column(String(10), nullable=True)  # HH:MM format, e.g. "08:30"
    is_prn = Column(Boolean, default=False, index=True)  # PRN = al bisogno
    notes = Column(String(500), nullable=True)
    color = Column(String(20), nullable=True)  # hex color for UI
    icon = Column(String(10), nullable=True)  # emoji icon

    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    logs = relationship("MedicationLog", back_populates="medication", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Medication(id={self.id}, name={self.name}, dosage={self.dosage})>"


class MedicationLog(Base):
    """Log of medication taken or skipped."""

    __tablename__ = "medication_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id = Column(
        UUID(as_uuid=True), ForeignKey("medications.id"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    taken_at = Column(DateTime, nullable=False, index=True)
    skipped = Column(Boolean, default=False)
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    medication = relationship("Medication", back_populates="logs")

    def __repr__(self) -> str:
        return f"<MedicationLog(id={self.id}, medication_id={self.medication_id})>"


class Workout(Base):
    """Workout tracking."""

    __tablename__ = "workouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    workout_type = Column(SQLEnum(WorkoutType), nullable=False, index=True)
    intensity = Column(SQLEnum(WorkoutIntensity), nullable=False, default=WorkoutIntensity.MODERATE)
    duration_minutes = Column(Integer, nullable=False)
    calories_burned = Column(Integer, nullable=True)
    distance_km = Column(Float, nullable=True)
    avg_heart_rate = Column(Integer, nullable=True)
    max_heart_rate = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(String(100), nullable=False, default="manual")

    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Workout(id={self.id}, type={self.workout_type}, duration={self.duration_minutes}min)>"


class SleepSession(Base):
    """Sleep session tracking."""

    __tablename__ = "sleep_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    sleep_start = Column(DateTime, nullable=False, index=True)
    sleep_end = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # total sleep time

    # Sleep quality metrics
    quality_score = Column(Integer, nullable=True)  # 0-100
    time_in_bed_minutes = Column(Integer, nullable=True)
    sleep_efficiency = Column(Float, nullable=True)  # percentage

    # Phase durations in minutes
    awake_minutes = Column(Integer, default=0)
    light_minutes = Column(Integer, default=0)
    deep_minutes = Column(Integer, default=0)
    rem_minutes = Column(Integer, default=0)

    # Source
    source = Column(String(100), nullable=False, default="manual")  # sleep_cycle, apple_health, manual
    external_id = Column(String(255), nullable=True)  # ID from Sleep Cycle / Apple Health

    # Morning report
    mood_on_wake = Column(String(50), nullable=True)  # great, good, okay, bad, terrible
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    phases = relationship("SleepPhaseEntry", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<SleepSession(id={self.id}, date={self.sleep_start.date()}, quality={self.quality_score})>"


class SleepPhaseEntry(Base):
    """Individual sleep phase entry within a session."""

    __tablename__ = "sleep_phases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("sleep_sessions.id"), nullable=False, index=True
    )

    phase = Column(SQLEnum(SleepPhase), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    session = relationship("SleepSession", back_populates="phases")

    def __repr__(self) -> str:
        return f"<SleepPhaseEntry(id={self.id}, phase={self.phase})>"
