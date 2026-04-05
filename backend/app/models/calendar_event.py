"""Calendar event model."""
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class CalendarEvent(Base):
    """Calendar events from Apple Calendar or manual entries."""

    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    title = Column(String(255), nullable=False, index=True)
    description = Column(String(2000), nullable=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False)
    location = Column(String(500), nullable=True)

    # Event source
    source = Column(String(50), default="manual")  # apple, manual, google, etc.
    calendar_name = Column(String(255), nullable=True)

    # Display
    color = Column(String(7), default="#3B82F6")  # hex color
    is_all_day = Column(Boolean, default=False)

    # Sync tracking
    external_id = Column(String(500), nullable=True)  # ID from external calendar
    synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<CalendarEvent(id={self.id}, title={self.title}, start_time={self.start_time})>"
