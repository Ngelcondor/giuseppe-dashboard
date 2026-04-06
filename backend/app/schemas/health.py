"""Health and medication schemas."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
import uuid
from app.models.health import MetricType, WorkoutType, WorkoutIntensity


class HealthMetricBase(BaseModel):
    """Base health metric schema."""

    metric_type: MetricType
    value: float
    unit: str
    recorded_at: datetime
    source: str = "manual"


class HealthMetricCreate(HealthMetricBase):
    """Health metric creation schema."""

    pass


class HealthMetricUpdate(BaseModel):
    """Health metric update schema."""

    value: Optional[float] = None
    unit: Optional[str] = None
    recorded_at: Optional[datetime] = None
    source: Optional[str] = None


class HealthMetricResponse(HealthMetricBase):
    """Health metric response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthSummary(BaseModel):
    """Health summary for a time period."""

    period: str  # "daily", "weekly", "monthly"
    start_date: datetime
    end_date: datetime
    metrics: dict  # Key: metric_type, Value: list of metrics


class MedicationBase(BaseModel):
    """Base medication schema."""

    name: str
    dosage: str
    frequency: str
    time_of_day: str
    scheduled_time: Optional[str] = None  # HH:MM format
    is_prn: bool = False
    notes: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True


class MedicationCreate(MedicationBase):
    """Medication creation schema."""

    pass


class MedicationUpdate(BaseModel):
    """Medication update schema."""

    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    time_of_day: Optional[str] = None
    scheduled_time: Optional[str] = None
    is_prn: Optional[bool] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class MedicationResponse(MedicationBase):
    """Medication response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MedicationLogBase(BaseModel):
    """Base medication log schema."""

    taken_at: datetime
    skipped: bool = False
    notes: Optional[str] = None


class MedicationLogCreate(MedicationLogBase):
    """Medication log creation schema."""

    medication_id: uuid.UUID


class MedicationLogResponse(MedicationLogBase):
    """Medication log response schema."""

    id: uuid.UUID
    medication_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class MedicationScheduleItem(BaseModel):
    """A medication with its today's log status."""

    medication: MedicationResponse
    taken_today: bool = False
    skipped_today: bool = False
    last_log: Optional[MedicationLogResponse] = None


class MedicationTodayResponse(BaseModel):
    """Today's medication schedule grouped by time."""

    scheduled: dict[str, list[MedicationScheduleItem]]  # key = scheduled_time
    prn: list[MedicationScheduleItem]


class AppleHealthImportRequest(BaseModel):
    """Request for Apple Health data import."""

    data: str  # CSV or XML data from Apple Health export
    format: str = "csv"  # csv or xml


class AppleHealthImportResponse(BaseModel):
    """Response from Apple Health data import."""

    metrics_imported: int = 0
    workouts_imported: int = 0
    sleep_sessions_imported: int = 0
    errors: List[str] = []


class HealthMetricBatch(BaseModel):
    """Batch health metrics for import."""

    metrics: List[HealthMetricCreate]


# ─── Workout Schemas ─────────────────────────────────────────────────────────


class WorkoutBase(BaseModel):
    """Base workout schema."""

    workout_type: WorkoutType
    intensity: WorkoutIntensity = WorkoutIntensity.MODERATE
    duration_minutes: int
    calories_burned: Optional[int] = None
    distance_km: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    notes: Optional[str] = None
    source: str = "manual"
    started_at: datetime
    ended_at: Optional[datetime] = None


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(BaseModel):
    workout_type: Optional[WorkoutType] = None
    intensity: Optional[WorkoutIntensity] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    distance_km: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class WorkoutResponse(WorkoutBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkoutWeekSummary(BaseModel):
    """Weekly workout summary."""

    workouts: List[WorkoutResponse]
    total_workouts: int = 0
    total_duration_minutes: int = 0
    total_calories: int = 0
    total_distance_km: float = 0.0
    avg_duration_minutes: float = 0.0
    by_type: dict = {}  # workout_type -> count


# ─── Sleep Schemas ────────────────────────────────────────────────────────────


class SleepPhaseEntryBase(BaseModel):
    """Base sleep phase entry."""

    phase: str  # awake, light, deep, rem
    start_time: datetime
    end_time: datetime
    duration_minutes: int


class SleepPhaseEntryCreate(SleepPhaseEntryBase):
    pass


class SleepPhaseEntryResponse(SleepPhaseEntryBase):
    id: uuid.UUID
    session_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SleepSessionBase(BaseModel):
    """Base sleep session."""

    sleep_start: datetime
    sleep_end: datetime
    duration_minutes: int
    quality_score: Optional[int] = None
    time_in_bed_minutes: Optional[int] = None
    sleep_efficiency: Optional[float] = None
    awake_minutes: int = 0
    light_minutes: int = 0
    deep_minutes: int = 0
    rem_minutes: int = 0
    source: str = "manual"
    external_id: Optional[str] = None
    mood_on_wake: Optional[str] = None
    notes: Optional[str] = None


class SleepSessionCreate(SleepSessionBase):
    phases: Optional[List[SleepPhaseEntryCreate]] = None


class SleepSessionUpdate(BaseModel):
    quality_score: Optional[int] = None
    mood_on_wake: Optional[str] = None
    notes: Optional[str] = None


class SleepSessionResponse(SleepSessionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    phases: List[SleepPhaseEntryResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SleepMorningReport(BaseModel):
    """Morning report aggregating last night's sleep."""

    session: Optional[SleepSessionResponse] = None
    quality_label: str = "Nessun dato"  # Ottimo, Buono, Sufficiente, Scarso
    total_hours: float = 0.0
    deep_pct: float = 0.0
    rem_pct: float = 0.0
    efficiency_pct: float = 0.0
    tip: str = ""  # Suggerimento personalizzato
    streak_days: int = 0  # Giorni consecutivi con dati sonno


class SleepWeekSummary(BaseModel):
    """Weekly sleep summary."""

    sessions: List[SleepSessionResponse]
    avg_duration_minutes: float = 0.0
    avg_quality: float = 0.0
    avg_deep_pct: float = 0.0
    avg_rem_pct: float = 0.0
    best_night: Optional[SleepSessionResponse] = None
    worst_night: Optional[SleepSessionResponse] = None
