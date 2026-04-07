"""Sleep tracking endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, date
from typing import List

from app.core.database import get_db
from app.models.health import SleepSession, SleepPhaseEntry

# Dashboard personale — utente singolo, niente auth
DEFAULT_USER_ID = "686859db-326c-4a2a-847e-99042c35eafc"
from app.schemas.health import (
    SleepSessionCreate,
    SleepSessionResponse,
    SleepSessionUpdate,
    SleepMorningReport,
    SleepWeekSummary,
    SleepPhaseEntryResponse,
)

router = APIRouter(prefix="/health/sleep", tags=["sleep"])


@router.post("", response_model=SleepSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_sleep_session(
    session_data: SleepSessionCreate,
    db: AsyncSession = Depends(get_db),
) -> SleepSessionResponse:
    """Create a new sleep session with optional phase data."""
    session = SleepSession(
        user_id=DEFAULT_USER_ID,
        sleep_start=session_data.sleep_start,
        sleep_end=session_data.sleep_end,
        duration_minutes=session_data.duration_minutes,
        quality_score=session_data.quality_score,
        time_in_bed_minutes=session_data.time_in_bed_minutes,
        sleep_efficiency=session_data.sleep_efficiency,
        awake_minutes=session_data.awake_minutes,
        light_minutes=session_data.light_minutes,
        deep_minutes=session_data.deep_minutes,
        rem_minutes=session_data.rem_minutes,
        source=session_data.source,
        external_id=session_data.external_id,
        mood_on_wake=session_data.mood_on_wake,
        notes=session_data.notes,
    )
    db.add(session)
    await db.flush()

    # Add phases if provided
    if session_data.phases:
        for phase_data in session_data.phases:
            phase = SleepPhaseEntry(
                session_id=session.id,
                phase=phase_data.phase,
                start_time=phase_data.start_time,
                end_time=phase_data.end_time,
                duration_minutes=phase_data.duration_minutes,
            )
            db.add(phase)

    await db.commit()
    await db.refresh(session)
    return SleepSessionResponse.from_orm(session)


@router.get("", response_model=List[SleepSessionResponse])
async def list_sleep_sessions(
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
) -> List[SleepSessionResponse]:
    """List sleep sessions for the last N days."""
    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(SleepSession)
        .where(
            (SleepSession.user_id == DEFAULT_USER_ID)
            & (SleepSession.sleep_start >= start_date)
        )
        .options(selectinload(SleepSession.phases))
        .order_by(SleepSession.sleep_start.desc())
    )
    sessions = result.scalars().all()
    return [SleepSessionResponse.from_orm(s) for s in sessions]


@router.get("/last-night", response_model=SleepSessionResponse)
async def get_last_night(
    db: AsyncSession = Depends(get_db),
) -> SleepSessionResponse:
    """Get last night's sleep session."""
    result = await db.execute(
        select(SleepSession)
        .where(SleepSession.user_id == DEFAULT_USER_ID)
        .options(selectinload(SleepSession.phases))
        .order_by(SleepSession.sleep_start.desc())
        .limit(1)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sleep data found")
    return SleepSessionResponse.from_orm(session)


@router.get("/morning-report", response_model=SleepMorningReport)
async def get_morning_report(
    db: AsyncSession = Depends(get_db),
) -> SleepMorningReport:
    """Get the morning report based on last night's sleep."""
    # Get last night session
    result = await db.execute(
        select(SleepSession)
        .where(SleepSession.user_id == DEFAULT_USER_ID)
        .options(selectinload(SleepSession.phases))
        .order_by(SleepSession.sleep_start.desc())
        .limit(1)
    )
    session = result.scalars().first()

    if not session:
        return SleepMorningReport(
            quality_label="Nessun dato",
            tip="Inizia a tracciare il tuo sonno per ricevere suggerimenti personalizzati.",
        )

    # Calculate metrics
    total_hours = session.duration_minutes / 60.0
    total_sleep = session.light_minutes + session.deep_minutes + session.rem_minutes
    deep_pct = (session.deep_minutes / total_sleep * 100) if total_sleep > 0 else 0
    rem_pct = (session.rem_minutes / total_sleep * 100) if total_sleep > 0 else 0
    efficiency = session.sleep_efficiency or (
        (session.duration_minutes / session.time_in_bed_minutes * 100)
        if session.time_in_bed_minutes and session.time_in_bed_minutes > 0
        else 0
    )

    # Quality label
    score = session.quality_score or 0
    if score >= 85:
        quality_label = "Ottimo"
    elif score >= 70:
        quality_label = "Buono"
    elif score >= 50:
        quality_label = "Sufficiente"
    elif score > 0:
        quality_label = "Scarso"
    else:
        quality_label = "N/D"

    # Generate tip
    tip = _generate_sleep_tip(total_hours, deep_pct, rem_pct, efficiency)

    # Calculate streak
    streak = await _calculate_sleep_streak(db, DEFAULT_USER_ID)

    return SleepMorningReport(
        session=SleepSessionResponse.from_orm(session),
        quality_label=quality_label,
        total_hours=round(total_hours, 1),
        deep_pct=round(deep_pct, 1),
        rem_pct=round(rem_pct, 1),
        efficiency_pct=round(efficiency, 1),
        tip=tip,
        streak_days=streak,
    )


@router.get("/week-summary", response_model=SleepWeekSummary)
async def get_week_summary(
    db: AsyncSession = Depends(get_db),
) -> SleepWeekSummary:
    """Get weekly sleep summary."""
    start_date = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(SleepSession)
        .where(
            (SleepSession.user_id == DEFAULT_USER_ID)
            & (SleepSession.sleep_start >= start_date)
        )
        .options(selectinload(SleepSession.phases))
        .order_by(SleepSession.sleep_start.desc())
    )
    sessions = result.scalars().all()
    session_responses = [SleepSessionResponse.from_orm(s) for s in sessions]

    if not sessions:
        return SleepWeekSummary(sessions=[])

    avg_duration = sum(s.duration_minutes for s in sessions) / len(sessions)
    scores = [s.quality_score for s in sessions if s.quality_score]
    avg_quality = sum(scores) / len(scores) if scores else 0

    total_sleep_all = []
    for s in sessions:
        total_sleep = s.light_minutes + s.deep_minutes + s.rem_minutes
        if total_sleep > 0:
            total_sleep_all.append((s.deep_minutes / total_sleep * 100, s.rem_minutes / total_sleep * 100))

    avg_deep = sum(d for d, r in total_sleep_all) / len(total_sleep_all) if total_sleep_all else 0
    avg_rem = sum(r for d, r in total_sleep_all) / len(total_sleep_all) if total_sleep_all else 0

    best = max(sessions, key=lambda s: s.quality_score or 0)
    worst = min(sessions, key=lambda s: s.quality_score or 0)

    return SleepWeekSummary(
        sessions=session_responses,
        avg_duration_minutes=round(avg_duration, 1),
        avg_quality=round(avg_quality, 1),
        avg_deep_pct=round(avg_deep, 1),
        avg_rem_pct=round(avg_rem, 1),
        best_night=SleepSessionResponse.from_orm(best) if best.quality_score else None,
        worst_night=SleepSessionResponse.from_orm(worst) if worst.quality_score else None,
    )


@router.get("/{session_id}", response_model=SleepSessionResponse)
async def get_sleep_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> SleepSessionResponse:
    """Get a specific sleep session with phase data."""
    result = await db.execute(
        select(SleepSession).where(
            (SleepSession.id == session_id)
            & (SleepSession.user_id == DEFAULT_USER_ID)
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sleep session not found")
    return SleepSessionResponse.from_orm(session)


@router.put("/{session_id}", response_model=SleepSessionResponse)
async def update_sleep_session(
    session_id: str,
    update_data: SleepSessionUpdate,
    db: AsyncSession = Depends(get_db),
) -> SleepSessionResponse:
    """Update a sleep session (mood, notes, quality)."""
    result = await db.execute(
        select(SleepSession).where(
            (SleepSession.id == session_id)
            & (SleepSession.user_id == DEFAULT_USER_ID)
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sleep session not found")

    data = update_data.dict(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(session, field, value)

    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SleepSessionResponse.from_orm(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sleep_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sleep session."""
    result = await db.execute(
        select(SleepSession).where(
            (SleepSession.id == session_id)
            & (SleepSession.user_id == DEFAULT_USER_ID)
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sleep session not found")

    await db.delete(session)
    await db.commit()


# ─── Helper functions ─────────────────────────────────────────────────────────


def _generate_sleep_tip(total_hours: float, deep_pct: float, rem_pct: float, efficiency: float) -> str:
    """Generate a personalized sleep tip based on metrics."""
    tips = []

    if total_hours < 6:
        tips.append("Hai dormito meno di 6 ore. Prova ad andare a letto prima stasera.")
    elif total_hours < 7:
        tips.append("Quasi 7 ore — prova a guadagnare 30 minuti in più per un sonno ottimale.")
    elif total_hours >= 8:
        tips.append("Ottima durata del sonno! Continua così.")

    if deep_pct < 15:
        tips.append("Il sonno profondo è basso. Evita caffeina dopo le 14 e fai attività fisica.")
    elif deep_pct > 25:
        tips.append("Eccellente quantità di sonno profondo — ottimo per il recupero.")

    if rem_pct < 15:
        tips.append("Il sonno REM è sotto la media. Riduci lo stress prima di dormire.")
    elif rem_pct > 25:
        tips.append("Buona quantità di sonno REM — importante per la memoria e l'umore.")

    if efficiency < 80:
        tips.append("L'efficienza del sonno è bassa. Evita schermi 30 min prima di dormire.")

    return " ".join(tips) if tips else "Il tuo sonno sembra nella norma. Mantieni le buone abitudini!"


async def _calculate_sleep_streak(db: AsyncSession, user_id: str) -> int:
    """Calculate consecutive days with sleep data."""
    result = await db.execute(
        select(SleepSession)
        .where(SleepSession.user_id == user_id)
        .order_by(SleepSession.sleep_start.desc())
        .limit(30)
    )
    sessions = result.scalars().all()

    if not sessions:
        return 0

    streak = 0
    check_date = date.today()
    session_dates = {s.sleep_start.date() for s in sessions}
    # Also check yesterday since sleep might end today but start yesterday
    session_end_dates = {s.sleep_end.date() for s in sessions}
    all_dates = session_dates | session_end_dates

    for i in range(30):
        d = check_date - timedelta(days=i)
        if d in all_dates:
            streak += 1
        else:
            break

    return streak
