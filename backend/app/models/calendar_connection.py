"""CalDAV calendar connection model for storing user's calendar provider credentials."""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class CalendarConnection(Base):
    """Stores CalDAV connection info for syncing external calendars (Apple, Google, etc.)."""

    __tablename__ = "calendar_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Provider info
    provider = Column(String(50), nullable=False)  # "apple", "google", "nextcloud", etc.
    display_name = Column(String(255), nullable=False)  # User-friendly name

    # CalDAV credentials (encrypted at rest via app-level encryption)
    caldav_url = Column(String(500), nullable=False)
    username = Column(String(255), nullable=False)
    app_password = Column(Text, nullable=False)  # App-specific password, encrypted

    # Connection status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(50), nullable=True)  # "success", "error", "partial"
    last_sync_error = Column(Text, nullable=True)

    # Sync preferences
    sync_interval_minutes = Column(String(10), default="15")  # How often to auto-sync
    calendars_filter = Column(Text, nullable=True)  # JSON list of calendar IDs to sync

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<CalendarConnection(id={self.id}, provider={self.provider}, user_id={self.user_id})>"
