"""Deadline and task tracking model."""
from sqlalchemy import Column, String, Date, DateTime, Boolean, Integer, Numeric, JSON, Enum as SQLEnum, ForeignKey
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


class RecurrenceType(str, Enum):
    """How a deadline repeats."""

    NONE = "none"            # singola — one-off deadline (legacy behaviour)
    INSTALLMENTS = "installments"  # rate — fixed number of payments
    SUBSCRIPTION = "subscription"  # abbonamento — recurring forever


class RecurrenceInterval(str, Enum):
    """Cadence of a subscription deadline."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


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

    # Recurrence (rate / abbonamento). All nullable so _sync_missing_columns
    # can add them to existing 'deadlines' rows without a migration.
    recurrence_type = Column(
        SQLEnum(RecurrenceType), nullable=True, default=RecurrenceType.NONE
    )
    # installments (rate)
    installments_total = Column(Integer, nullable=True)
    installments_paid = Column(Integer, nullable=True, default=0)
    # subscription (abbonamento)
    recurrence_interval = Column(SQLEnum(RecurrenceInterval), nullable=True)
    # amount per rata / per period (numeric, currency-agnostic)
    amount = Column(Numeric(12, 2), nullable=True)
    # Per-occurrence paid ledger: ISO date strings (YYYY-MM-DD) of the individual
    # rate / subscription charges the user has ticked as paid. Independent of
    # installments_paid (which is the pre-app baseline), so each occurrence can be
    # checked/unchecked reversibly. Nullable so _sync_missing_columns can ALTER it in.
    paid_occurrences = Column(JSON, nullable=True)

    # Additional info
    notes = Column(String(2000), nullable=True)
    external_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Deadline(id={self.id}, title={self.title}, due_date={self.due_date})>"
