"""App settings — shared key/value integration config store, user-scoped.

Used by every integration slice (HTB, Hue, Shelly, Google Calendar, OpenBanking,
Weather, Family, Style, …). One row per (user_id, key); `value` is an opaque JSON
blob whose shape is owned by the consuming slice. See settings_store helpers.
"""
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class AppSetting(Base):
    __tablename__ = "app_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_app_settings_user_key"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    key = Column(String(64), nullable=False, index=True)
    value = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
