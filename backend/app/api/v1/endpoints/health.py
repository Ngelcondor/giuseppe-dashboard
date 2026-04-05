"""Health and medication endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from datetime import datetime, timedelta, date
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
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
)

router = APIRouter(prefix="/health", tags=["health"])


@router.post("/metrics", response_model=HealthMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_health_metric(
    metric: HealthMetricCreate,
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[HealthMetricResponse]:
    """List health metrics."""
    query = select(HealthMetric).where(HealthMetric.user_id == current_user["sub"])

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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthMetricResponse:
    """Get a specific health metric."""
    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.id == metric_id)
            & (HealthMetric.user_id == current_user["sub"])
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
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
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
            (HealthMetric.user_id == current_user["sub"])
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
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MedicationResponse]:
    """List all medications."""
    result = await db.execute(
        select(Medication).where(Medication.user_id == current_user["sub"])
    )
    medications = result.scalars().all()
    return [MedicationResponse.from_orm(m) for m in medications]


@router.get("/medications/today", response_model=MedicationTodayResponse)
async def get_today_medications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationTodayResponse:
    """Get today's medication schedule with log status."""
    # Get all active medications
    result = await db.execute(
        select(Medication).where(
            (Medication.user_id == current_user["sub"])
            & (Medication.is_active == True)
        )
    )
    medications = result.scalars().all()

    # Get today's logs
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())
    logs_result = await db.execute(
        select(MedicationLog).where(
            (MedicationLog.user_id == current_user["sub"])
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


async def _ensure_medication_columns(db: AsyncSession) -> None:
    """Auto-repair: add missing columns to medications table if needed."""
    columns_to_add = [
        ("scheduled_time", "VARCHAR(10)"),
        ("is_prn", "BOOLEAN DEFAULT false"),
        ("color", "VARCHAR(20)"),
        ("icon", "VARCHAR(10)"),
    ]
    for col_name, col_def in columns_to_add:
        try:
            await db.execute(text(
                f'ALTER TABLE medications ADD COLUMN "{col_name}" {col_def}'
            ))
            logger.info(f"Added missing column medications.{col_name}")
        except Exception:
            # Column already exists — this is fine
            await db.rollback()
    await db.commit()


@router.post("/medications/seed", response_model=List[MedicationResponse], status_code=status.HTTP_201_CREATED)
async def seed_medications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MedicationResponse]:
    """Seed Giuseppe's medications. Auto-repairs DB schema if needed."""
    # Step 0: ensure new columns exist
    await _ensure_medication_columns(db)

    # Step 1: check if user already has medications
    result = await db.execute(
        select(func.count(Medication.id)).where(
            Medication.user_id == current_user["sub"]
        )
    )
    count = result.scalar()
    if count and count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Medications already exist. Delete them first to re-seed."
        )

    seed_data = [
        # Mattina 08:30
        {
            "name": "Duloxetina",
            "dosage": "60mg",
            "frequency": "daily",
            "time_of_day": "mattina",
            "scheduled_time": "08:30",
            "is_prn": False,
            "color": "#6366F1",
            "icon": "💊",
            "notes": "Antidepressivo SNRI",
        },
        {
            "name": "Aripiprazolo",
            "dosage": "5mg",
            "frequency": "daily",
            "time_of_day": "mattina",
            "scheduled_time": "08:30",
            "is_prn": False,
            "color": "#8B5CF6",
            "icon": "💊",
            "notes": "Antipsicotico atipico",
        },
        {
            "name": "Metilfenidato",
            "dosage": "27mg",
            "frequency": "daily",
            "time_of_day": "mattina",
            "scheduled_time": "08:30",
            "is_prn": False,
            "color": "#F59E0B",
            "icon": "⚡",
            "notes": "ADHD - rilascio prolungato",
        },
        {
            "name": "PrEP",
            "dosage": "1cp",
            "frequency": "daily",
            "time_of_day": "mattina",
            "scheduled_time": "08:30",
            "is_prn": False,
            "color": "#10B981",
            "icon": "🛡️",
            "notes": "Profilassi pre-esposizione",
        },
        # Sera 21:00
        {
            "name": "Psyllium",
            "dosage": "1400mg",
            "frequency": "daily",
            "time_of_day": "sera",
            "scheduled_time": "21:00",
            "is_prn": False,
            "color": "#F97316",
            "icon": "🌿",
            "notes": "Fibra - integratore",
        },
        # Notte 23:30
        {
            "name": "Quetiapina",
            "dosage": "25mg",
            "frequency": "daily",
            "time_of_day": "notte",
            "scheduled_time": "23:30",
            "is_prn": False,
            "color": "#3B82F6",
            "icon": "🌙",
            "notes": "Antipsicotico - per il sonno",
        },
        # PRN (al bisogno)
        {
            "name": "Olanzapina",
            "dosage": "2.5mg",
            "frequency": "prn",
            "time_of_day": "al bisogno",
            "scheduled_time": None,
            "is_prn": True,
            "color": "#EF4444",
            "icon": "🆘",
            "notes": "Al bisogno - ansia/agitazione acuta",
        },
        {
            "name": "Clonazepam",
            "dosage": "0.5mg",
            "frequency": "prn",
            "time_of_day": "al bisogno",
            "scheduled_time": None,
            "is_prn": True,
            "color": "#EC4899",
            "icon": "🆘",
            "notes": "Al bisogno - ansia/panico",
        },
    ]

    created = []
    for data in seed_data:
        med = Medication(user_id=current_user["sub"], **data)
        db.add(med)
        created.append(med)

    await db.commit()
    for med in created:
        await db.refresh(med)

    return [MedicationResponse.from_orm(m) for m in created]


@router.put("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: str,
    medication_update: MedicationUpdate,
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
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

    med_log = MedicationLog(
        medication_id=medication_id,
        user_id=current_user["sub"],
        taken_at=log_data.taken_at,
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MedicationLogResponse]:
    """Get logs for a medication."""
    result = await db.execute(
        select(Medication).where(
            (Medication.id == medication_id)
            & (Medication.user_id == current_user["sub"])
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
