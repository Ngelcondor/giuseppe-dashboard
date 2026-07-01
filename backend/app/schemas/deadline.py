"""Deadline schemas."""
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
import uuid
from app.models.deadline import (
    DeadlineCategory,
    DeadlinePriority,
    RecurrenceType,
    RecurrenceInterval,
)


class DeadlineBase(BaseModel):
    """Base deadline schema."""

    title: str
    description: Optional[str] = None
    due_date: date
    category: DeadlineCategory = DeadlineCategory.PERSONAL
    priority: DeadlinePriority = DeadlinePriority.MEDIUM
    reminder_days_before: int = 1
    notes: Optional[str] = None
    external_url: Optional[str] = None
    # Recurrence (rate / abbonamento)
    recurrence_type: RecurrenceType = RecurrenceType.NONE
    installments_total: Optional[int] = None
    installments_paid: Optional[int] = 0
    recurrence_interval: Optional[RecurrenceInterval] = None
    amount: Optional[Decimal] = None
    # ISO dates (YYYY-MM-DD) of individually-paid occurrences (rate / charges).
    paid_occurrences: Optional[List[str]] = None


class DeadlineCreate(DeadlineBase):
    """Deadline creation schema."""

    pass


class DeadlineUpdate(BaseModel):
    """Deadline update schema."""

    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    category: Optional[DeadlineCategory] = None
    priority: Optional[DeadlinePriority] = None
    reminder_days_before: Optional[int] = None
    notes: Optional[str] = None
    external_url: Optional[str] = None
    is_completed: Optional[bool] = None
    completion_notes: Optional[str] = None
    # Recurrence
    recurrence_type: Optional[RecurrenceType] = None
    installments_total: Optional[int] = None
    installments_paid: Optional[int] = None
    recurrence_interval: Optional[RecurrenceInterval] = None
    amount: Optional[Decimal] = None


class DeadlineResponse(DeadlineBase):
    """Deadline response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    is_completed: bool
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeadlineCompleteRequest(BaseModel):
    """Request to mark deadline as complete."""

    completion_notes: Optional[str] = None


class DeadlineOccurrencePaidRequest(BaseModel):
    """Mark a single occurrence (one rata / one subscription charge) paid or not."""

    date: date
    paid: bool


class DeadlineUpcomingResponse(BaseModel):
    """Upcoming and overdue deadlines."""

    upcoming: List[DeadlineResponse]
    overdue: List[DeadlineResponse]


# ── Expanded recurring occurrences ──
class DeadlineOccurrence(BaseModel):
    """A single computed (non-persisted) occurrence of a deadline.

    For installments this is one remaining unpaid rata; for subscriptions one
    upcoming period; for one-off deadlines the deadline itself.
    """

    deadline_id: uuid.UUID
    title: str
    category: DeadlineCategory
    priority: DeadlinePriority
    recurrence_type: RecurrenceType
    date: date
    amount: Optional[Decimal] = None
    # 1-based index within the series (installment number), null for one-off
    occurrence_index: Optional[int] = None
    # total in the series (installments_total), null for subscriptions/one-off
    occurrence_total: Optional[int] = None


class DeadlineOccurrencesResponse(BaseModel):
    """Expanded occurrences for the next N months."""

    months: int
    horizon_end: date
    occurrences: List[DeadlineOccurrence]
