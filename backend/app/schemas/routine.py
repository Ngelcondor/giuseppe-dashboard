"""Routine schemas."""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid
from app.models.routine import TimeOfDay


class RoutineStepBase(BaseModel):
    """Base routine step schema."""

    title: str
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_optional: bool = False
    order: int = 0
    icon: Optional[str] = None


class RoutineStepCreate(RoutineStepBase):
    """Routine step creation schema."""

    pass


class RoutineStepUpdate(BaseModel):
    """Routine step update schema."""

    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_optional: Optional[bool] = None
    order: Optional[int] = None
    icon: Optional[str] = None


class RoutineStepResponse(RoutineStepBase):
    """Routine step response schema."""

    id: uuid.UUID
    routine_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class RoutineBase(BaseModel):
    """Base routine schema."""

    name: str
    description: Optional[str] = None
    time_of_day: TimeOfDay
    is_active: bool = True
    order: int = 0


class RoutineCreate(RoutineBase):
    """Routine creation schema."""

    steps: List[RoutineStepCreate] = []


class RoutineUpdate(BaseModel):
    """Routine update schema."""

    name: Optional[str] = None
    description: Optional[str] = None
    time_of_day: Optional[TimeOfDay] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class RoutineResponse(RoutineBase):
    """Routine response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    steps: List[RoutineStepResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoutineLogBase(BaseModel):
    """Base routine log schema."""

    completed_steps: List[str] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


class RoutineLogCreate(RoutineLogBase):
    """Routine log creation schema."""

    routine_id: uuid.UUID


class RoutineLogResponse(RoutineLogBase):
    """Routine log response schema."""

    id: uuid.UUID
    routine_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class RoutineStartRequest(BaseModel):
    """Request to start a routine."""

    pass


class RoutineCompleteRequest(BaseModel):
    """Request to complete a routine."""

    completed_steps: List[str] = []
    notes: Optional[str] = None


class RoutineTodayResponse(BaseModel):
    """Routines scheduled for today."""

    morning: Optional[RoutineResponse] = None
    afternoon: Optional[RoutineResponse] = None
    evening: Optional[RoutineResponse] = None
    night: Optional[RoutineResponse] = None
