"""API Token schemas."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid


class APITokenCreate(BaseModel):
    """Request to create a new API token."""

    name: str = Field(..., min_length=1, max_length=100, examples=["Health Auto Export"])
    scope: str = Field(default="webhook", pattern="^(webhook|api|full)$")
    description: Optional[str] = None
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)


class APITokenResponse(BaseModel):
    """API token info (without the actual token value)."""

    id: uuid.UUID
    name: str
    token_prefix: str
    scope: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class APITokenCreated(APITokenResponse):
    """Response after creating a token — includes the full token (shown only once)."""

    token: str  # Full token, shown only at creation time


class APITokenList(BaseModel):
    """List of API tokens."""

    tokens: list[APITokenResponse]
    total: int


class WebhookSecretResponse(BaseModel):
    """Current webhook secret info."""

    is_configured: bool
    secret_preview: Optional[str] = None  # First 8 chars + "..."
    hint: str = "Usa questo token come Bearer token in Health Auto Export"
