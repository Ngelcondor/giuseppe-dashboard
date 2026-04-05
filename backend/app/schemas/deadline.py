"""Deadline schemas."""
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
import uuid
from app.models.deadline import DeadlineCategory, DeadlinePriority


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


class DeadlineUpcomingResponse(BaseModel):
    """Upcoming and overdue deadlines."""

    upcoming: List[DeadlineResponse]
    overdue: List[DeadlineResponse]
