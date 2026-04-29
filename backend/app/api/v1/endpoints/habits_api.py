"""Public habits endpoints — no auth required (auth disabled temporarily)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.models.habit import Habit, HabitLog
from app.models.user import User

router = APIRouter(prefix="/habits-api", tags=["habits-api"])

# Fixed placeholder user until auth is re-enabled
DEFAULT_USER = UUID("00000000-0000-0000-0000-000000000001")

# ADHD/ASD-friendly default habits
DEFAULT_HABITS = [
    {"name": "Farmaci mattina",           "icon": "💊", "color": "#EF4444"},
    {"name": "Idratazione (8 bicchieri)", "icon": "💧", "color": "#3B82F6"},
    {"name": "Routine mattino",           "icon": "☀️", "color": "#F59E0B"},
    {"name": "Pasti regolari",            "icon": "🍎", "color": "#10B981"},
    {"name": "Esercizio fisico",          "icon": "🏃", "color": "#F97316"},
    {"name": "Studio cybersecurity",      "icon": "🔐", "color": "#8B5CF6"},
    {"name": "Pausa sensoriale",          "icon": "🧘", "color": "#6366F1"},
    {"name": "Uscita all'aperto",         "icon": "🌿", "color": "#84CC16"},
    {"name": "Sonno a orario fisso",      "icon": "😴", "color": "#14B8A6"},
    {"name": "Journaling / check-in",     "icon": "✍️", "color": "#EC4899"},
]


# ── Pydantic schemas ────────────────────────────────────────────────────────

class HabitOut(BaseModel):
    id: UUID
    name: str
    icon: Optional[str] = None
    color: str
    done_today: bool = False
    current_streak: int = 0
    longest_streak: int = 0

    class Config:
        from_attributes = True


class HabitCreate(BaseModel):
    name: str
    icon: Optional[str] = "⭐"
    color: Optional[str] = "#10B981"


class HeatmapDay(BaseModel):
    date: str
    done: bool


# ── Helpers ─────────────────────────────────────────────────────────────────

async def _compute_streaks(habit_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(HabitLog)
        .where(HabitLog.habit_id == habit_id, HabitLog.completed == True)
        .order_by(HabitLog.date.desc())
    )
    logs = result.scalars().all()
    if not logs:
        return 0, 0

    dates = sorted({l.date for l in logs}, reverse=True)
    today = date.today()

    # current streak
    current = 0
    cursor = today
    for d in dates:
        if d == cursor or d == cursor - timedelta(days=1):
            current += 1
            cursor = d
        else:
            break

    # longest streak
    longest = 1
    run = 1
    for i in range(1, len(dates)):
        if (dates[i-1] - dates[i]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    return current, max(longest, current)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[HabitOut])
async def list_habits(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Habit).where(Habit.user_id == DEFAULT_USER, Habit.is_active == True)
    )
    habits = result.scalars().all()
    today = date.today()

    out = []
    for h in habits:
        # Check done today
        log_res = await db.execute(
            select(HabitLog).where(
                HabitLog.habit_id == h.id,
                HabitLog.date == today,
                HabitLog.completed == True,
            )
        )
        done_today = log_res.scalars().first() is not None
        current, longest = await _compute_streaks(h.id, db)
        out.append(HabitOut(
            id=h.id, name=h.name, icon=h.icon, color=h.color,
            done_today=done_today, current_streak=current, longest_streak=longest,
        ))
    return out


async def _ensure_system_user(db: AsyncSession):
    """Create the system user if it doesn't exist yet.

    Note: username is 'system' (not 'giuseppe') to avoid colliding with the
    real admin user created by seed_admin_user() at app startup.
    """
    result = await db.execute(select(User).where(User.id == DEFAULT_USER))
    if not result.scalars().first():
        db.add(User(
            id=DEFAULT_USER,
            email="system@dashboard.local",
            username="system",
            hashed_password="disabled",
            is_active=True,
            is_verified=True,
        ))
        await db.commit()


@router.post("/seed", status_code=201)
async def seed_habits(db: AsyncSession = Depends(get_db)):
    await _ensure_system_user(db)
    result = await db.execute(select(Habit).where(Habit.user_id == DEFAULT_USER))
    if result.scalars().first():
        return {"message": "Already seeded"}
    for d in DEFAULT_HABITS:
        db.add(Habit(user_id=DEFAULT_USER, name=d["name"], icon=d["icon"], color=d["color"]))
    await db.commit()
    return {"message": "Seeded", "count": len(DEFAULT_HABITS)}


@router.post("", response_model=HabitOut, status_code=201)
async def create_habit(body: HabitCreate, db: AsyncSession = Depends(get_db)):
    await _ensure_system_user(db)
    h = Habit(user_id=DEFAULT_USER, name=body.name, icon=body.icon, color=body.color or "#10B981")
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return HabitOut(id=h.id, name=h.name, icon=h.icon, color=h.color)


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(habit_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Habit).where(Habit.id == habit_id))
    h = result.scalars().first()
    if not h:
        raise HTTPException(404, "Not found")
    await db.delete(h)
    await db.commit()


@router.post("/{habit_id}/toggle")
async def toggle_habit(habit_id: UUID, db: AsyncSession = Depends(get_db)):
    """Toggle today's completion for a habit."""
    today = date.today()
    result = await db.execute(
        select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.date == today)
    )
    log = result.scalars().first()

    if log:
        log.completed = not log.completed
    else:
        log = HabitLog(habit_id=habit_id, user_id=DEFAULT_USER, date=today, completed=True)
        db.add(log)

    await db.commit()

    current, longest = await _compute_streaks(habit_id, db)
    return {"done": log.completed, "current_streak": current, "longest_streak": longest}


@router.get("/{habit_id}/heatmap", response_model=List[HeatmapDay])
async def get_heatmap(habit_id: UUID, days: int = 365, db: AsyncSession = Depends(get_db)):
    """Return day-by-day completion for heatmap (last N days)."""
    end = date.today()
    start = end - timedelta(days=days - 1)

    result = await db.execute(
        select(HabitLog).where(
            HabitLog.habit_id == habit_id,
            HabitLog.date >= start,
            HabitLog.date <= end,
            HabitLog.completed == True,
        )
    )
    done_dates = {l.date for l in result.scalars().all()}

    days_list = []
    cursor = start
    while cursor <= end:
        days_list.append(HeatmapDay(date=cursor.isoformat(), done=cursor in done_dates))
        cursor += timedelta(days=1)
    return days_list
