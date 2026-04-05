"""Mood and sensory schemas."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
import uuid


class MoodEntryBase(BaseModel):
    """Base mood entry schema."""

    mood_level: int = Field(..., ge=1, le=10)
    energy_level: int = Field(..., ge=1, le=10)
    anxiety_level: int = Field(..., ge=1, le=10)
    notes: Optional[str] = None
    tags: List[str] = []
    recorded_at: datetime


class MoodEntryCreate(MoodEntryBase):
    """Mood entry creation schema."""

    pass


class MoodEntryUpdate(BaseModel):
    """Mood entry update schema."""

    mood_level: Optional[int] = Field(None, ge=1, le=10)
    energy_level: Optional[int] = Field(None, ge=1, le=10)
    anxiety_level: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class MoodEntryResponse(MoodEntryBase):
    """Mood entry response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SensoryLogBase(BaseModel):
    """Base sensory log schema."""

    intensity: int = Field(..., ge=1, le=10)
    trigger: str
    environment: Optional[str] = None
    coping_strategy: Optional[str] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    recorded_at: datetime


class SensoryLogCreate(SensoryLogBase):
    """Sensory log creation schema."""

    pass


class SensoryLogUpdate(BaseModel):
    """Sensory log update schema."""

    intensity: Optional[int] = Field(None, ge=1, le=10)
    trigger: Optional[str] = None
    environment: Optional[str] = None
    coping_strategy: Optional[str] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


class SensoryLogResponse(SensoryLogBase):
    """Sensory log response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class MoodTrendsResponse(BaseModel):
    """Mood trends over time."""

    period: str  # "week", "month"
    average_mood: float
    average_energy: float
    average_anxiety: float
    entries: List[MoodEntryResponse]


class MoodCorrelationResponse(BaseModel):
    """Correlation between mood and other metrics."""

    metric: str  # e.g., "sleep_quality", "exercise"
    correlation_coefficient: float
    sample_size: int
