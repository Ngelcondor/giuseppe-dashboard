"""Calendar event schemas."""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid


class CalendarEventBase(BaseModel):
    """Base calendar event schema."""

    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    source: str = "manual"
    calendar_name: Optional[str] = None
    color: str = "#3B82F6"
    is_all_day: bool = False


class CalendarEventCreate(CalendarEventBase):
    """Calendar event creation schema."""

    pass


class CalendarEventUpdate(BaseModel):
    """Calendar event update schema."""

    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    color: Optional[str] = None
    is_all_day: Optional[bool] = None


class CalendarEventResponse(CalendarEventBase):
    """Calendar event response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    external_id: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarUpcomingResponse(BaseModel):
    """Response for upcoming calendar events."""

    next_7_days: List[CalendarEventResponse]
    next_30_days: List[CalendarEventResponse]


class AppleCalendarSyncRequest(BaseModel):
    """Request for Apple Calendar sync."""

    calendar_ids: List[str]  # Apple Calendar IDs to sync
