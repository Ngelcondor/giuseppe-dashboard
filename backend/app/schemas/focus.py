"""Focus and productivity schemas."""
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List
import uuid


class PomodoroSessionBase(BaseModel):
    """Base Pomodoro session schema."""

    task_name: str
    duration_minutes: int = 25
    break_duration: int = 5
    category: Optional[str] = None
    notes: Optional[str] = None


class PomodoroSessionCreate(PomodoroSessionBase):
    """Pomodoro session creation schema."""

    started_at: datetime


class PomodoroSessionUpdate(BaseModel):
    """Pomodoro session update schema."""

    task_name: Optional[str] = None
    duration_minutes: Optional[int] = None
    break_duration: Optional[int] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class PomodoroSessionResponse(PomodoroSessionBase):
    """Pomodoro session response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PomodoroStartRequest(BaseModel):
    """Request to start Pomodoro session."""

    task_name: str
    duration_minutes: int = 25
    break_duration: int = 5
    category: Optional[str] = None


class PomodoroStopRequest(BaseModel):
    """Request to stop Pomodoro session."""

    completed: bool = True
    notes: Optional[str] = None


class FocusScoreBase(BaseModel):
    """Base focus score schema."""

    date: date
    score: float
    sleep_quality: Optional[float] = None
    resting_hr: Optional[float] = None
    focus_hours: Optional[float] = None
    exercise_minutes: Optional[int] = None
    notes: Optional[str] = None


class FocusScoreCreate(FocusScoreBase):
    """Focus score creation schema."""

    pass


class FocusScoreResponse(FocusScoreBase):
    """Focus score response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    calculated_at: datetime

    class Config:
        from_attributes = True


class FocusStatsResponse(BaseModel):
    """Focus statistics response."""

    period: str  # "week", "month"
    average_score: float
    best_day: Optional[date] = None
    worst_day: Optional[date] = None
    total_focus_hours: float
    scores: List[FocusScoreResponse]
