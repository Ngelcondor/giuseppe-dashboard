"""User model for authentication and profile."""
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class User(Base):
    """User model for authentication and dashboard configuration."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # 2FA Configuration
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False)

    # Account Status
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Dashboard and Theme Settings
    settings = Column(
        JSON,
        default={
            "theme": "light",
            "low_stimulation_mode": False,
            "notifications_enabled": True,
            "widgets": [],
            "dashboard_layout": "default",
        },
    )

    # Additional preferences
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")

    # Health preferences
    weight_unit = Column(String(10), default="kg")  # kg or lbs
    height_unit = Column(String(10), default="cm")  # cm or inches

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, username={self.username})>"
