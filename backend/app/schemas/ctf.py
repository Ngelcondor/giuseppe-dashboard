"""CTF challenge schemas."""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid
from app.models.ctf import CTFPlatformName, ChallengeCategory, ChallengeDifficulty


class CTFPlatformBase(BaseModel):
    """Base CTF platform schema."""

    platform_name: CTFPlatformName
    username: str
    profile_url: Optional[str] = None
    api_key_encrypted: Optional[str] = None


class CTFPlatformCreate(CTFPlatformBase):
    """CTF platform creation schema."""

    pass


class CTFPlatformUpdate(BaseModel):
    """CTF platform update schema."""

    username: Optional[str] = None
    profile_url: Optional[str] = None
    api_key_encrypted: Optional[str] = None


class CTFPlatformResponse(CTFPlatformBase):
    """CTF platform response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CTFChallengeBase(BaseModel):
    """Base CTF challenge schema."""

    name: str
    description: Optional[str] = None
    category: ChallengeCategory
    difficulty: Optional[ChallengeDifficulty] = None
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    time_spent_minutes: Optional[int] = None
    notes: Optional[str] = None
    writeup_url: Optional[str] = None


class CTFChallengeCreate(CTFChallengeBase):
    """CTF challenge creation schema."""

    platform_id: uuid.UUID


class CTFChallengeUpdate(BaseModel):
    """CTF challenge update schema."""

    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ChallengeCategory] = None
    difficulty: Optional[ChallengeDifficulty] = None
    is_completed: Optional[bool] = None
    time_spent_minutes: Optional[int] = None
    notes: Optional[str] = None
    writeup_url: Optional[str] = None


class CTFChallengeResponse(CTFChallengeBase):
    """CTF challenge response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    platform_id: uuid.UUID
    external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CTFStats(BaseModel):
    """CTF statistics."""

    total_challenges: int
    completed_challenges: int
    completion_rate: float
    by_category: dict  # category -> count
    by_difficulty: dict  # difficulty -> count
    total_time_spent_hours: float


class CTFProgress(BaseModel):
    """CTF progress by platform."""

    platform: CTFPlatformName
    username: str
    total_challenges: int
    completed_challenges: int
    completion_rate: float
    recent_challenges: List[CTFChallengeResponse]
