"""Mood and sensory endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, date
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mood import MoodEntry, SensoryLog
from app.schemas.mood import (
    MoodEntryCreate, MoodEntryResponse, MoodEntryUpdate,
    SensoryLogCreate, SensoryLogResponse, SensoryLogUpdate,
    MoodTrendsResponse, MoodCorrelationResponse,
)

router = APIRouter(prefix="/mood", tags=["mood"])


@router.post("/entries", response_model=MoodEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_mood_entry(
    entry: MoodEntryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodEntryResponse:
    """Create a mood entry."""
    mood_entry = MoodEntry(
        user_id=current_user["sub"],
        **entry.dict(),
    )
    db.add(mood_entry)
    await db.commit()
    await db.refresh(mood_entry)
    return MoodEntryResponse.from_orm(mood_entry)


@router.get("/entries", response_model=List[MoodEntryResponse])
async def list_mood_entries(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MoodEntryResponse]:
    """List mood entries."""
    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(MoodEntry)
        .where(
            (MoodEntry.user_id == current_user["sub"])
            & (MoodEntry.recorded_at >= start_date)
        )
        .order_by(MoodEntry.recorded_at.desc())
    )
    entries = result.scalars().all()
    return [MoodEntryResponse.from_orm(e) for e in entries]


@router.get("/entries/{entry_id}", response_model=MoodEntryResponse)
async def get_mood_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodEntryResponse:
    """Get a specific mood entry."""
    result = await db.execute(
        select(MoodEntry).where(
            (MoodEntry.id == entry_id)
            & (MoodEntry.user_id == current_user["sub"])
        )
    )
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return MoodEntryResponse.from_orm(entry)


@router.put("/entries/{entry_id}", response_model=MoodEntryResponse)
async def update_mood_entry(
    entry_id: str,
    entry_update: MoodEntryUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodEntryResponse:
    """Update a mood entry."""
    result = await db.execute(
        select(MoodEntry).where(
            (MoodEntry.id == entry_id)
            & (MoodEntry.user_id == current_user["sub"])
        )
    )
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    update_data = entry_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(entry, field, value)

    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return MoodEntryResponse.from_orm(entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mood_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a mood entry."""
    result = await db.execute(
        select(MoodEntry).where(
            (MoodEntry.id == entry_id)
            & (MoodEntry.user_id == current_user["sub"])
        )
    )
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    await db.delete(entry)
    await db.commit()


# Sensory logs
@router.post("/sensory", response_model=SensoryLogResponse, status_code=status.HTTP_201_CREATED)
async def create_sensory_log(
    log: SensoryLogCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SensoryLogResponse:
    """Log a sensory event."""
    sensory_log = SensoryLog(
        user_id=current_user["sub"],
        **log.dict(),
    )
    db.add(sensory_log)
    await db.commit()
    await db.refresh(sensory_log)
    return SensoryLogResponse.from_orm(sensory_log)


@router.get("/sensory", response_model=List[SensoryLogResponse])
async def list_sensory_logs(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SensoryLogResponse]:
    """List sensory logs."""
    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(SensoryLog)
        .where(
            (SensoryLog.user_id == current_user["sub"])
            & (SensoryLog.recorded_at >= start_date)
        )
        .order_by(SensoryLog.recorded_at.desc())
    )
    logs = result.scalars().all()
    return [SensoryLogResponse.from_orm(log) for log in logs]


@router.get("/sensory/{log_id}", response_model=SensoryLogResponse)
async def get_sensory_log(
    log_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SensoryLogResponse:
    """Get a specific sensory log."""
    result = await db.execute(
        select(SensoryLog).where(
            (SensoryLog.id == log_id)
            & (SensoryLog.user_id == current_user["sub"])
        )
    )
    log = result.scalars().first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    return SensoryLogResponse.from_orm(log)


@router.get("/trends", response_model=MoodTrendsResponse)
async def get_mood_trends(
    period: str = Query("week"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodTrendsResponse:
    """Get mood trends."""
    if period == "week":
        days = 7
    elif period == "month":
        days = 30
    else:
        days = 7

    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(MoodEntry)
        .where(
            (MoodEntry.user_id == current_user["sub"])
            & (MoodEntry.recorded_at >= start_date)
        )
        .order_by(MoodEntry.recorded_at)
    )
    entries = result.scalars().all()

    if not entries:
        return MoodTrendsResponse(
            period=period,
            average_mood=0.0,
            average_energy=0.0,
            average_anxiety=0.0,
            entries=[],
        )

    avg_mood = sum(e.mood_level for e in entries) / len(entries)
    avg_energy = sum(e.energy_level for e in entries) / len(entries)
    avg_anxiety = sum(e.anxiety_level for e in entries) / len(entries)

    return MoodTrendsResponse(
        period=period,
        average_mood=avg_mood,
        average_energy=avg_energy,
        average_anxiety=avg_anxiety,
        entries=[MoodEntryResponse.from_orm(e) for e in entries],
    )


@router.get("/correlations", response_model=List[MoodCorrelationResponse])
async def get_mood_correlations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MoodCorrelationResponse]:
    """Get correlations between mood and other metrics (mock data)."""
    return [
        MoodCorrelationResponse(
            metric="sleep_quality",
            correlation_coefficient=0.72,
            sample_size=30,
        ),
        MoodCorrelationResponse(
            metric="exercise_minutes",
            correlation_coefficient=0.65,
            sample_size=30,
        ),
        MoodCorrelationResponse(
            metric="heart_rate",
            correlation_coefficient=-0.45,
            sample_size=30,
        ),
    ]
