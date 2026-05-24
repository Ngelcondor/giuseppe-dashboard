"""Mood endpoints — authenticated."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import date, datetime, timedelta
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mood import MoodLog

router = APIRouter(
    prefix="/mood-api",
    tags=["mood-api"],
    dependencies=[Depends(get_current_user)],
)

TAGS_DEFAULT = [
    "Farmaci presi", "Buon sonno", "Poco sonno", "Esercizio",
    "Sovraccarico sensoriale", "Isolamento", "Socialità",
    "Stress studio", "Alimentazione irregolare", "Uscita all'aperto",
    "Mal di testa", "Caffè / energy",
]

# ── Schemas ──────────────────────────────────────────────────────────────────

class MoodCreate(BaseModel):
    mood: int           # 1-5
    energy: int         # 1-5
    anxiety: int        # 1-5
    stimming: int = 1   # 1-5
    notes: Optional[str] = None
    tags: List[str] = []

class MoodOut(BaseModel):
    id: UUID
    mood: int
    energy: int
    anxiety: int
    stimming: int
    notes: Optional[str]
    tags: List[str]
    logged_at: datetime
    log_date: date

    model_config = {"from_attributes": True}

class HistoryPoint(BaseModel):
    date: str
    mood: float
    energy: float
    anxiety: float
    stimming: float

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MoodOut])
async def list_logs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MoodLog).order_by(desc(MoodLog.logged_at)).limit(100)
    )
    return result.scalars().all()


@router.get("/today", response_model=List[MoodOut])
async def today_logs(db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(MoodLog)
        .where(MoodLog.log_date == today)
        .order_by(desc(MoodLog.logged_at))
    )
    return result.scalars().all()


@router.get("/history", response_model=List[HistoryPoint])
async def history(days: int = 14, db: AsyncSession = Depends(get_db)):
    """Return daily averages for the last N days (for the line chart)."""
    since = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(MoodLog)
        .where(MoodLog.log_date >= since)
        .order_by(MoodLog.log_date)
    )
    logs = result.scalars().all()

    # Group by date
    by_date: dict[str, list] = {}
    for d in range(days):
        ds = (since + timedelta(days=d)).isoformat()
        by_date[ds] = []
    for log in logs:
        key = log.log_date.isoformat()
        if key in by_date:
            by_date[key].append(log)

    points = []
    for ds, entries in by_date.items():
        if entries:
            points.append(HistoryPoint(
                date=ds,
                mood=round(sum(e.mood for e in entries) / len(entries), 1),
                energy=round(sum(e.energy for e in entries) / len(entries), 1),
                anxiety=round(sum(e.anxiety for e in entries) / len(entries), 1),
                stimming=round(sum(e.stimming for e in entries) / len(entries), 1),
            ))
        else:
            points.append(HistoryPoint(date=ds, mood=0, energy=0, anxiety=0, stimming=0))
    return points


@router.get("/tags")
async def get_tags():
    return TAGS_DEFAULT


@router.post("", response_model=MoodOut, status_code=201)
async def create_log(body: MoodCreate, db: AsyncSession = Depends(get_db)):
    for field, val in [("mood", body.mood), ("energy", body.energy),
                       ("anxiety", body.anxiety), ("stimming", body.stimming)]:
        if not 1 <= val <= 5:
            raise HTTPException(400, f"{field} deve essere tra 1 e 5")
    entry = MoodLog(
        mood=body.mood, energy=body.energy,
        anxiety=body.anxiety, stimming=body.stimming,
        notes=body.notes, tags=body.tags,
        log_date=date.today(), logged_at=datetime.utcnow(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{log_id}", status_code=204)
async def delete_log(log_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MoodLog).where(MoodLog.id == log_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(404, "Log non trovato")
    await db.delete(entry)
    await db.commit()
