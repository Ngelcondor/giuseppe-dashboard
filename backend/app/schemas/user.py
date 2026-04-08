"""User schemas."""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, Dict, Any
import uuid


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=255)


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """User update schema."""

    username: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    weight_unit: Optional[str] = None
    height_unit: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    """User response schema."""

    id: uuid.UUID
    is_active: bool
    is_verified: bool
    totp_enabled: bool
    timezone: str
    language: str
    weight_unit: str
    height_unit: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserLoginRequest(BaseModel):
    """User login request."""

    email: EmailStr
    password: str


class UserAuthResponse(BaseModel):
    """User authentication response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class TokenRefreshResponse(BaseModel):
    """Token refresh response."""

    access_token: str
    token_type: str = "bearer"


class PasswordChangeRequest(BaseModel):
    """Password change request."""

    current_password: str
    new_password: str = Field(..., min_length=8)


class PasswordChangeResponse(BaseModel):
    """Password change response."""

    success: bool
    message: str


class TOTPSetupResponse(BaseModel):
    """TOTP setup response."""

    secret: str
    qr_code: str
    provisioning_uri: str


class TOTPVerifyRequest(BaseModel):
    """TOTP verification request."""

    token: str


class TOTPVerifyResponse(BaseModel):
    """TOTP verification response."""

    success: bool
    message: str
