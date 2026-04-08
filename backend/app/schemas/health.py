"""Health and medication schemas."""
from pydantic import BaseModel, Field, field_validator
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

    medication_id: Optional[uuid.UUID] = None  # Optional: taken from path param if not provided


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


# ─── Medication Statistics Schemas ────────────────────────────────────────────


class MedicationStatItem(BaseModel):
    """Stats for a single scheduled medication over a period."""

    medication_id: uuid.UUID
    name: str
    dosage: str
    color: Optional[str] = None
    icon: Optional[str] = None
    scheduled_time: Optional[str] = None
    total_expected: int  # giorni nel periodo in cui il farmaco era attivo
    total_taken: int
    total_skipped: int
    total_missed: int  # expected - taken - skipped (nessun log)
    adherence_pct: float  # (taken / expected) * 100


class PRNStatItem(BaseModel):
    """Stats for a single PRN (al bisogno) medication."""

    medication_id: uuid.UUID
    name: str
    dosage: str
    color: Optional[str] = None
    icon: Optional[str] = None
    total_intakes: int  # quante volte è stato assunto nel periodo
    days_used: int  # in quanti giorni diversi
    avg_per_day_used: float  # media assunzioni nei giorni in cui è stato usato


class MedicationStatsResponse(BaseModel):
    """Monthly/custom period medication statistics report."""

    period_start: str  # YYYY-MM-DD
    period_end: str  # YYYY-MM-DD
    period_label: str  # e.g. "Marzo 2026"
    total_days: int
    # Farmaci schedulati
    scheduled_stats: List[MedicationStatItem]
    overall_adherence_pct: float  # media aderenza globale
    # Farmaci al bisogno
    prn_stats: List[PRNStatItem]
    total_prn_intakes: int  # totale assunzioni PRN nel periodo


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
    # Sleep Cycle specific
    sc_quality_score: Optional[int] = None
    snoring_minutes: Optional[int] = None
    snoring_pct: Optional[float] = None
    regularity_score: Optional[int] = None
    sleep_aid_used: Optional[str] = None
    alarm_mode: Optional[str] = None
    wake_up_mood: Optional[str] = None
    heart_rate_lowest: Optional[int] = None
    steps_to_sleep: Optional[int] = None
    # Common
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


# ─── Sleep Cycle Webhook Schemas ─────────────────────────────────────────────


class SleepCyclePhase(BaseModel):
    """Single sleep phase from Sleep Cycle via HealthKit."""

    phase: str  # awake, light, deep, rem
    start_time: str  # ISO-8601
    end_time: str  # ISO-8601
    duration_minutes: int


class SleepCycleWebhookPayload(BaseModel):
    """Payload sent by the iOS Shortcut reading Sleep Cycle data from HealthKit.

    The Shortcut reads HealthKit sleep analysis (written by Sleep Cycle)
    and optionally scrapes extra data from Sleep Cycle's UI via Shortcuts actions.

    Empty strings from iOS Shortcuts are coerced to None/0 by validators.
    """

    # Core sleep data (from HealthKit)
    sleep_start: str = ""  # ISO-8601
    sleep_end: str = ""    # ISO-8601
    duration_minutes: Optional[int] = None
    time_in_bed_minutes: Optional[int] = None

    # Phase breakdown (from HealthKit sleep analysis)
    awake_minutes: Optional[int] = 0
    light_minutes: Optional[int] = 0
    deep_minutes: Optional[int] = 0
    rem_minutes: Optional[int] = 0
    phases: Optional[List[SleepCyclePhase]] = None

    # Sleep Cycle specific (scraped from SC or passed as extras)
    sc_quality_score: Optional[int] = None
    snoring_minutes: Optional[int] = None
    regularity_score: Optional[int] = None
    sleep_aid_used: Optional[str] = None
    alarm_mode: Optional[str] = None
    wake_up_mood: Optional[str] = None
    heart_rate_lowest: Optional[int] = None
    steps_to_sleep: Optional[int] = None

    # Metadata
    mood_on_wake: Optional[str] = None
    notes: Optional[str] = None

    @field_validator(
        "duration_minutes", "time_in_bed_minutes", "awake_minutes",
        "light_minutes", "deep_minutes", "rem_minutes",
        "sc_quality_score", "snoring_minutes", "regularity_score",
        "heart_rate_lowest", "steps_to_sleep",
        mode="before",
    )
    @classmethod
    def empty_str_to_none_int(cls, v: object) -> object:
        """Convert empty string '' to None for Optional[int] fields."""
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            try:
                return int(float(v))
            except (ValueError, TypeError):
                return None
        return v

    @field_validator("sleep_aid_used", "alarm_mode", "wake_up_mood",
                     "mood_on_wake", "notes", mode="before")
    @classmethod
    def empty_str_to_none_str(cls, v: object) -> object:
        """Convert empty string '' to None for Optional[str] fields."""
        if isinstance(v, str) and not v.strip():
            return None
        return v


class SleepCycleSyncResponse(BaseModel):
    """Response from Sleep Cycle webhook sync."""

    ok: bool = True
    session_id: Optional[str] = None
    imported: bool = False
    skipped: bool = False
    reason: Optional[str] = None
    synced_at: str = ""
