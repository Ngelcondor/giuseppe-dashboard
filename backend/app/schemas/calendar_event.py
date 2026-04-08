"""Calendar event schemas."""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Optional, List
import uuid


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    return to_camel(name)


class CalendarEventBase(BaseModel):
    """Base calendar event schema."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

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

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    color: Optional[str] = None
    is_all_day: Optional[bool] = None


class CalendarEventResponse(CalendarEventBase):
    """Calendar event response schema."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    id: uuid.UUID
    user_id: uuid.UUID
    external_id: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CalendarUpcomingResponse(BaseModel):
    """Response for upcoming calendar events."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    next_7_days: List[CalendarEventResponse]
    next_30_days: List[CalendarEventResponse]


class AppleCalendarSyncRequest(BaseModel):
    """Request for Apple Calendar sync."""

    calendar_ids: List[str]  # Apple Calendar IDs to sync
