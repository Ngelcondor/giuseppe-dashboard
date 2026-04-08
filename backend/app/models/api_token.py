"""API Token model for external integrations."""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class APIToken(Base):
    """API Token for webhook and external service authentication."""

    __tablename__ = "api_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Token info
    name = Column(String(100), nullable=False)  # e.g. "Health Auto Export", "Webhook iOS"
    token_hash = Column(String(255), nullable=False, unique=True)
    token_prefix = Column(String(8), nullable=False)  # First 8 chars for identification

    # Scope/purpose
    scope = Column(String(50), nullable=False, default="webhook")  # webhook, api, full

    # Status
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # null = never expires

    # Notes
    description = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<APIToken(id={self.id}, name={self.name}, prefix={self.token_prefix}...)>"
