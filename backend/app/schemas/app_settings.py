"""Schemas for the settings store and account management."""
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ── Settings ──
class SettingUpdate(BaseModel):
    """Body for PUT /settings/{key}."""
    value: dict


# ── Account / users ──
class MeResponse(BaseModel):
    email: str
    role: str
    full_name: str


class UserSummary(BaseModel):
    id: UUID
    email: str
    role: str
    full_name: str
    is_active: bool

    class Config:
        from_attributes = True


class GuestCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(default="", max_length=120)
