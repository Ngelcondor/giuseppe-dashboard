"""Schemas for CalDAV calendar connections."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
import uuid


class CalDAVCalendarInfoSchema(BaseModel):
    """Info about a remote calendar discovered via CalDAV."""
    calendar_id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None


class CalendarConnectionCreate(BaseModel):
    """Request to create a new CalDAV connection."""
    provider: str = Field(..., description="Provider: apple, google, nextcloud, custom")
    display_name: str = Field(..., description="Nome visualizzato per questa connessione")
    caldav_url: Optional[str] = Field(
        None,
        description="URL CalDAV custom. Se omesso, usa l'URL predefinito del provider.",
    )
    username: str = Field(..., description="Username (Apple ID email per iCloud)")
    app_password: str = Field(..., description="App-specific password")
    sync_interval_minutes: str = "15"


class CalendarConnectionResponse(BaseModel):
    """Response schema for a calendar connection."""
    id: uuid.UUID
    user_id: uuid.UUID
    provider: str
    display_name: str
    caldav_url: str
    username: str
    is_active: bool
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    sync_interval_minutes: str
    calendars_filter: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarConnectionTestResponse(BaseModel):
    """Response for connection test."""
    success: bool
    calendars_count: Optional[int] = None
    calendars: Optional[List[CalDAVCalendarInfoSchema]] = None
    error: Optional[str] = None
    message: Optional[str] = None


class CalendarSyncRequest(BaseModel):
    """Request to trigger a calendar sync."""
    connection_id: uuid.UUID
    calendar_ids: Optional[List[str]] = Field(
        None, description="Specifici calendar IDs da sincronizzare. Se omesso, sincronizza tutti."
    )
    days_back: int = Field(7, ge=0, le=90)
    days_forward: int = Field(90, ge=1, le=365)


class CalendarSyncResponse(BaseModel):
    """Response for a sync operation."""
    success: bool
    events_synced: int = 0
    events_created: int = 0
    events_updated: int = 0
    events_deleted: int = 0
    error: Optional[str] = None
    sync_range: Optional[dict] = None


class CalendarConnectionUpdate(BaseModel):
    """Update a calendar connection."""
    display_name: Optional[str] = None
    app_password: Optional[str] = None
    is_active: Optional[bool] = None
    sync_interval_minutes: Optional[str] = None
    calendars_filter: Optional[str] = None
