"""Habit schemas."""
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List, Dict
import uuid
from app.models.habit import HabitFrequency


class HabitBase(BaseModel):
    """Base habit schema."""

    name: str
    description: Optional[str] = None
    frequency: HabitFrequency = HabitFrequency.DAILY
    target_per_period: int = 1
    unit: Optional[str] = None
    color: str = "#10B981"
    icon: Optional[str] = None
    is_active: bool = True


class HabitCreate(HabitBase):
    """Habit creation schema."""

    pass


class HabitUpdate(BaseModel):
    """Habit update schema."""

    name: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[HabitFrequency] = None
    target_per_period: Optional[int] = None
    unit: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class HabitResponse(HabitBase):
    """Habit response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HabitLogBase(BaseModel):
    """Base habit log schema."""

    date: date
    completed: bool = False
    value: Optional[float] = None
    notes: Optional[str] = None


class HabitLogCreate(HabitLogBase):
    """Habit log creation schema."""

    habit_id: uuid.UUID


class HabitLogResponse(HabitLogBase):
    """Habit log response schema."""

    id: uuid.UUID
    habit_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class HabitGridResponse(BaseModel):
    """GitHub-style habit grid response (for visualization)."""

    habit_id: uuid.UUID
    habit_name: str
    grid_data: Dict[str, bool]  # date_string -> completed


class HabitStreakResponse(BaseModel):
    """Habit streak information."""

    habit_id: uuid.UUID
    habit_name: str
    current_streak: int
    longest_streak: int
    last_completed: Optional[date] = None


class HabitsGridResponse(BaseModel):
    """All habits grid data."""

    habits: List[HabitGridResponse]
    date_range: Dict[str, date]


class HabitsStreaksResponse(BaseModel):
    """All habits streaks."""

    habits: List[HabitStreakResponse]
