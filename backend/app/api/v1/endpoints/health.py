"""Health and medication endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_
from datetime import datetime, timedelta, date, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import require_editor
from app.core.sections import get_view_user_id
from app.models.health import HealthMetric, Medication, MedicationLog, MetricType

logger = logging.getLogger(__name__)
from app.schemas.health import (
    HealthMetricCreate,
    HealthMetricResponse,
    HealthMetricUpdate,
    HealthSummary,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    MedicationLogCreate,
    MedicationLogResponse,
    MedicationScheduleItem,
    MedicationTodayResponse,
    MedicationStatsResponse,
    MedicationStatItem,
    PRNStatItem,
)

router = APIRouter(prefix="/health", tags=["health"])


@router.post("/metrics", response_model=HealthMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_health_metric(
    metric: HealthMetricCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> HealthMetricResponse:
    """Create a new health metric."""
    health_metric = HealthMetric(
        user_id=current_user["sub"],
        metric_type=metric.metric_type,
        value=metric.value,
        unit=metric.unit,
        recorded_at=metric.recorded_at,
        source=metric.source,
    )
    db.add(health_metric)
    await db.commit()
    await db.refresh(health_metric)
    return HealthMetricResponse.from_orm(health_metric)


@router.get("/metrics", response_model=List[HealthMetricResponse])
async def list_health_metrics(
    metric_type: MetricType = Query(None),
    days: int = Query(30),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[HealthMetricResponse]:
    """List health metrics."""
    query = select(HealthMetric).where(HealthMetric.user_id == view_user_id)

    if metric_type:
        query = query.where(HealthMetric.metric_type == metric_type)

    start_date = datetime.utcnow() - timedelta(days=days)
    query = query.where(HealthMetric.recorded_at >= start_date)

    result = await db.execute(query)
    metrics = result.scalars().all()
    return [HealthMetricResponse.from_orm(m) for m in metrics]


@router.get("/metrics/{metric_id}", response_model=HealthMetricResponse)
async def get_health_metric(
    metric_id: str,
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> HealthMetricResponse:
    """Get a specific health metric."""
    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.id == metric_id)
            & (HealthMetric.user_id == view_user_id)
        )
    )
    metric = result.scalars().first()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")
    return HealthMetricResponse.from_orm(metric)


@router.put("/metrics/{metric_id}", response_model=HealthMetricResponse)
async def update_health_metric(
    metric_id: str,
    metric_update: HealthMetricUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> HealthMetricResponse:
    """Update a health metric."""
    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.id == metric_id)
            & (HealthMetric.user_id == current_user["sub"])
        )
    )
    metric = result.scalars().first()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")

    update_data = metric_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(metric, field, value)

    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return HealthMetricResponse.from_orm(metric)


@router.delete("/metrics/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_metric(
    metric_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a health metric."""
    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.id == metric_id)
            & (HealthMetric.user_id == current_user["sub"])
        )
    )
    metric = result.scalars().first()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")

    await db.delete(metric)
    await db.commit()


@router.get("/summary", response_model=HealthSummary)
async def get_health_summary(
    period: str = Query("daily"),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> HealthSummary:
    """Get health summary for a period."""
    if period == "daily":
        days = 1
    elif period == "weekly":
        days = 7
    elif period == "monthly":
        days = 30
    else:
        days = 1

    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(HealthMetric)
        .where(
            (HealthMetric.user_id == view_user_id)
            & (HealthMetric.recorded_at >= start_date)
        )
        .order_by(HealthMetric.recorded_at)
    )
    metrics = result.scalars().all()

    metrics_by_type = {}
    for metric in metrics:
        type_name = metric.metric_type.value
        if type_name not in metrics_by_type:
            metrics_by_type[type_name] = []
        metrics_by_type[type_name].append(HealthMetricResponse.from_orm(metric))

    return HealthSummary(
        period=period,
        start_date=start_date,
        end_date=datetime.utcnow(),
        metrics=metrics_by_type,
    )


# Medication endpoints
@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    medication: MedicationCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> MedicationResponse:
    """Create a new medication."""
    med = Medication(
        user_id=current_user["sub"],
        name=medication.name,
        dosage=medication.dosage,
        frequency=medication.frequency,
        time_of_day=medication.time_of_day,
        scheduled_time=medication.scheduled_time,
        is_prn=medication.is_prn,
        notes=medication.notes,
        color=medication.color,
        icon=medication.icon,
        is_active=medication.is_active,
    )
    db.add(med)
    await db.commit()
    await db.refresh(med)
    return MedicationResponse.from_orm(med)


@router.get("/medications", response_model=List[MedicationResponse])
async def list_medications(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[MedicationResponse]:
    """List all medications."""
    result = await db.execute(
        select(Medication).where(Medication.user_id == view_user_id)
    )
    medications = result.scalars().all()
    return [MedicationResponse.from_orm(m) for m in medications]


@router.get("/medications/today", response_model=MedicationTodayResponse)
async def get_today_medications(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> MedicationTodayResponse:
    """Get today's medication schedule with log status."""
    # Get all active medications
    result = await db.execute(
        select(Medication).where(
            (Medication.user_id == view_user_id)
            & (Medication.is_active == True)
        )
    )
    medications = result.scalars().all()

    # Get today's logs — use Italian timezone so "today" matches the user's local day
    tz_rome = ZoneInfo("Europe/Rome")
    today_local = datetime.now(tz_rome).date()
    today_start = datetime.combine(today_local, datetime.min.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)
    today_end = datetime.combine(today_local, datetime.max.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)
    logs_result = await db.execute(
        select(MedicationLog).where(
            (MedicationLog.user_id == view_user_id)
            & (MedicationLog.taken_at >= today_start)
            & (MedicationLog.taken_at <= today_end)
        )
    )
    today_logs = logs_result.scalars().all()

    # Index logs by medication_id
    logs_by_med = {}
    for log in today_logs:
        med_id = str(log.medication_id)
        if med_id not in logs_by_med:
            logs_by_med[med_id] = []
        logs_by_med[med_id].append(log)

    scheduled: dict[str, list[MedicationScheduleItem]] = {}
    prn: list[MedicationScheduleItem] = []

    for med in medications:
        med_id = str(med.id)
        med_logs = logs_by_med.get(med_id, [])
        taken = any(not log.skipped for log in med_logs)
        skipped = any(log.skipped for log in med_logs)
        last_log = None
        if med_logs:
            last = sorted(med_logs, key=lambda l: l.taken_at)[-1]
            last_log = MedicationLogResponse.from_orm(last)

        item = MedicationScheduleItem(
            medication=MedicationResponse.from_orm(med),
            taken_today=taken,
            skipped_today=skipped,
            last_log=last_log,
        )

        if med.is_prn:
            prn.append(item)
        else:
            time_key = med.scheduled_time or med.time_of_day or "altro"
            if time_key not in scheduled:
                scheduled[time_key] = []
            scheduled[time_key].append(item)

    # Sort scheduled times
    sorted_scheduled = dict(sorted(scheduled.items()))

    return MedicationTodayResponse(scheduled=sorted_scheduled, prn=prn)


@router.get("/medications/stats", response_model=MedicationStatsResponse)
async def get_medication_stats(
    year: int = Query(None, description="Anno (default: anno corrente)"),
    month: int = Query(None, description="Mese 1-12 (default: mese corrente)"),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> MedicationStatsResponse:
    """Get medication adherence statistics for a given month.

    Returns per-medication taken/skipped/missed counts for scheduled meds,
    and intake counts for PRN (al bisogno) medications.
    """
    import calendar
    from collections import defaultdict

    tz_rome = ZoneInfo("Europe/Rome")
    now_rome = datetime.now(tz_rome)

    # Default to current month
    y = year or now_rome.year
    m = month or now_rome.month

    # Period boundaries (Italian timezone)
    first_day = date(y, m, 1)
    last_day_num = calendar.monthrange(y, m)[1]
    last_day = date(y, m, last_day_num)

    # If we're in the current month, cap at today
    today_rome = now_rome.date()
    if last_day > today_rome:
        last_day = today_rome

    total_days = (last_day - first_day).days + 1

    # Convert to UTC datetimes for DB queries
    period_start_utc = datetime.combine(first_day, datetime.min.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)
    period_end_utc = datetime.combine(last_day, datetime.max.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)

    # Get all active medications
    result = await db.execute(
        select(Medication).where(
            (Medication.user_id == view_user_id)
            & (Medication.is_active == True)
        )
    )
    medications = result.scalars().all()

    # Get all logs in the period
    logs_result = await db.execute(
        select(MedicationLog).where(
            (MedicationLog.user_id == view_user_id)
            & (MedicationLog.taken_at >= period_start_utc)
            & (MedicationLog.taken_at <= period_end_utc)
        )
    )
    all_logs = logs_result.scalars().all()

    # Index logs by medication_id
    logs_by_med: dict[str, list] = defaultdict(list)
    for log in all_logs:
        logs_by_med[str(log.medication_id)].append(log)

    scheduled_stats: list[MedicationStatItem] = []
    prn_stats: list[PRNStatItem] = []
    total_prn_intakes = 0

    for med in medications:
        med_id = str(med.id)
        med_logs = logs_by_med.get(med_id, [])

        if med.is_prn:
            # PRN: count total intakes and unique days
            taken_logs = [l for l in med_logs if not l.skipped]
            unique_days = set()
            for log in taken_logs:
                log_local = log.taken_at.replace(tzinfo=timezone.utc).astimezone(tz_rome).date()
                unique_days.add(log_local)

            intakes = len(taken_logs)
            days_used = len(unique_days)
            total_prn_intakes += intakes

            prn_stats.append(PRNStatItem(
                medication_id=med.id,
                name=med.name,
                dosage=med.dosage,
                color=med.color,
                icon=med.icon,
                total_intakes=intakes,
                days_used=days_used,
                avg_per_day_used=round(intakes / days_used, 1) if days_used > 0 else 0.0,
            ))
        else:
            # Scheduled: count taken/skipped per unique day
            # Expected = total_days (one dose per day for daily meds)
            # For meds created after the period start, adjust expected
            med_created = med.created_at.date() if med.created_at else first_day
            effective_start = max(first_day, med_created)
            expected = max(0, (last_day - effective_start).days + 1)

            # Count unique days with taken/skipped logs
            taken_days = set()
            skipped_days = set()
            for log in med_logs:
                log_local = log.taken_at.replace(tzinfo=timezone.utc).astimezone(tz_rome).date()
                if not log.skipped:
                    taken_days.add(log_local)
                else:
                    skipped_days.add(log_local)

            total_taken = len(taken_days)
            total_skipped = len(skipped_days - taken_days)  # only days that were ONLY skipped
            total_missed = max(0, expected - total_taken - total_skipped)

            scheduled_stats.append(MedicationStatItem(
                medication_id=med.id,
                name=med.name,
                dosage=med.dosage,
                color=med.color,
                icon=med.icon,
                scheduled_time=med.scheduled_time,
                total_expected=expected,
                total_taken=total_taken,
                total_skipped=total_skipped,
                total_missed=total_missed,
                adherence_pct=round((total_taken / expected) * 100, 1) if expected > 0 else 0.0,
            ))

    # Overall adherence
    total_expected_all = sum(s.total_expected for s in scheduled_stats)
    total_taken_all = sum(s.total_taken for s in scheduled_stats)
    overall_adherence = round((total_taken_all / total_expected_all) * 100, 1) if total_expected_all > 0 else 0.0

    # Period label in Italian
    month_names_it = [
        "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
    ]
    period_label = f"{month_names_it[m]} {y}"

    return MedicationStatsResponse(
        period_start=first_day.isoformat(),
        period_end=last_day.isoformat(),
        period_label=period_label,
        total_days=total_days,
        scheduled_stats=scheduled_stats,
        overall_adherence_pct=overall_adherence,
        prn_stats=prn_stats,
        total_prn_intakes=total_prn_intakes,
    )


@router.put("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: str,
    medication_update: MedicationUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> MedicationResponse:
    """Update a medication."""
    result = await db.execute(
        select(Medication).where(
            (Medication.id == medication_id)
            & (Medication.user_id == current_user["sub"])
        )
    )
    medication = result.scalars().first()
    if not medication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    update_data = medication_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(medication, field, value)

    db.add(medication)
    await db.commit()
    await db.refresh(medication)
    return MedicationResponse.from_orm(medication)


@router.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medication(
    medication_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a medication."""
    result = await db.execute(
        select(Medication).where(
            (Medication.id == medication_id)
            & (Medication.user_id == current_user["sub"])
        )
    )
    medication = result.scalars().first()
    if not medication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    await db.delete(medication)
    await db.commit()


# Medication logs
@router.post("/medications/{medication_id}/log", response_model=MedicationLogResponse, status_code=status.HTTP_201_CREATED)
async def log_medication(
    medication_id: str,
    log_data: MedicationLogCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> MedicationLogResponse:
    """Log medication taken or skipped."""
    # Verify medication belongs to user
    result = await db.execute(
        select(Medication).where(
            (Medication.id == medication_id)
            & (Medication.user_id == current_user["sub"])
        )
    )
    medication = result.scalars().first()
    if not medication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    # Strip timezone info — DB column is naive UTC
    taken_at = log_data.taken_at
    if taken_at.tzinfo is not None:
        taken_at = taken_at.astimezone(timezone.utc).replace(tzinfo=None)

    med_log = MedicationLog(
        medication_id=medication_id,
        user_id=current_user["sub"],
        taken_at=taken_at,
        skipped=log_data.skipped,
        notes=log_data.notes,
    )
    db.add(med_log)
    await db.commit()
    await db.refresh(med_log)
    return MedicationLogResponse.from_orm(med_log)


@router.get("/medications/{medication_id}/logs", response_model=List[MedicationLogResponse])
async def get_medication_logs(
    medication_id: str,
    days: int = Query(30),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[MedicationLogResponse]:
    """Get logs for a medication."""
    result = await db.execute(
        select(Medication).where(
            (Medication.id == medication_id)
            & (Medication.user_id == view_user_id)
        )
    )
    medication = result.scalars().first()
    if not medication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(MedicationLog)
        .where(
            (MedicationLog.medication_id == medication_id)
            & (MedicationLog.taken_at >= start_date)
        )
        .order_by(MedicationLog.taken_at.desc())
    )
    logs = result.scalars().all()
    return [MedicationLogResponse.from_orm(log) for log in logs]


# ─── Medication Webhook (iOS Shortcut) ──────────────────────────────────────

class MedWebhookPayload(BaseModel):
    """Payload from iOS Shortcut to log a medication intake."""
    medication_name: str           # e.g. "Duloxetina"
    skipped: bool = False
    notes: Optional[str] = None

_bearer_scheme = HTTPBearer(auto_error=False)


async def _verify_med_webhook_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    from app.core.config import settings
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook non configurato.")
    if not credentials or credentials.credentials != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non valido.")


@router.post("/medications/webhook", dependencies=[Depends(_verify_med_webhook_token)])
@router.get("/medications/webhook", dependencies=[Depends(_verify_med_webhook_token)])
async def medication_webhook(
    payload: Optional[MedWebhookPayload] = None,  # JSON body (POST)
    name: Optional[str] = Query(None, description="Medication name (alternative to JSON body)"),
    skip: bool = Query(False, description="Mark as skipped instead of taken"),
    note: Optional[str] = Query(None, description="Optional note"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log medication intake from iOS Shortcut.

    Accepts both JSON body or query params:
    - POST with JSON: {"medication_name": "Duloxetina"}
    - GET/POST with query: ?name=Duloxetina
    """
    # Resolve medication name from body or query param
    med_name = name
    skipped = skip
    notes = note
    if payload and payload.medication_name:
        med_name = payload.medication_name
        skipped = payload.skipped
        notes = payload.notes
    if not med_name:
        raise HTTPException(status_code=400, detail="Specifica il nome del farmaco via ?name= o nel body JSON.")
    from app.models.user import User

    # Resolve single admin user
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Nessun utente trovato.")

    # Find medication by name (case-insensitive)
    result = await db.execute(
        select(Medication).where(
            and_(
                Medication.user_id == user.id,
                Medication.is_active == True,
                func.lower(Medication.name) == med_name.lower().strip(),
            )
        )
    )
    medication = result.scalar_one_or_none()
    if not medication:
        # Try partial match
        result = await db.execute(
            select(Medication).where(
                and_(
                    Medication.user_id == user.id,
                    Medication.is_active == True,
                    func.lower(Medication.name).contains(med_name.lower().strip()),
                )
            )
        )
        medication = result.scalar_one_or_none()

    if not medication:
        return {
            "ok": False,
            "error": f"Farmaco '{med_name}' non trovato.",
            "available": [],
        }

    # Deduplication: check if already logged today for this med (Italian timezone)
    tz_rome = ZoneInfo("Europe/Rome")
    today_local = datetime.now(tz_rome).date()
    today_start = datetime.combine(today_local, datetime.min.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)
    dup = await db.execute(
        select(MedicationLog.id).where(
            and_(
                MedicationLog.medication_id == medication.id,
                MedicationLog.user_id == user.id,
                MedicationLog.taken_at >= today_start,
                MedicationLog.skipped == skipped,
            )
        ).limit(1)
    )
    if dup.scalar_one_or_none():
        return {
            "ok": True,
            "skipped_duplicate": True,
            "medication": medication.name,
            "message": f"{medication.name} già registrato oggi.",
        }

    med_log = MedicationLog(
        medication_id=medication.id,
        user_id=user.id,
        taken_at=datetime.utcnow(),
        skipped=skipped,
        notes=notes,
    )
    db.add(med_log)
    await db.commit()

    return {
        "ok": True,
        "medication": medication.name,
        "dosage": medication.dosage,
        "skipped": skipped,
        "logged_at": datetime.now(timezone.utc).isoformat(),
    }
