"""Habit endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, datetime, timedelta
from typing import List, Dict

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.habit import Habit, HabitLog
from app.schemas.habit import (
    HabitCreate, HabitResponse, HabitUpdate,
    HabitLogCreate, HabitLogResponse,
    HabitGridResponse, HabitsGridResponse,
    HabitStreakResponse, HabitsStreaksResponse,
)

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    habit: HabitCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitResponse:
    """Create a habit."""
    new_habit = Habit(user_id=current_user["sub"], **habit.dict())
    db.add(new_habit)
    await db.commit()
    await db.refresh(new_habit)
    return HabitResponse.from_orm(new_habit)


@router.get("", response_model=List[HabitResponse])
async def list_habits(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[HabitResponse]:
    """List all habits."""
    result = await db.execute(
        select(Habit).where(Habit.user_id == current_user["sub"])
    )
    habits = result.scalars().all()
    return [HabitResponse.from_orm(h) for h in habits]


@router.get("/{habit_id}", response_model=HabitResponse)
async def get_habit(
    habit_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitResponse:
    """Get a specific habit."""
    result = await db.execute(
        select(Habit).where(
            (Habit.id == habit_id)
            & (Habit.user_id == current_user["sub"])
        )
    )
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return HabitResponse.from_orm(habit)


@router.put("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: str,
    habit_update: HabitUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitResponse:
    """Update a habit."""
    result = await db.execute(
        select(Habit).where(
            (Habit.id == habit_id)
            & (Habit.user_id == current_user["sub"])
        )
    )
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")

    update_data = habit_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(habit, field, value)

    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return HabitResponse.from_orm(habit)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a habit."""
    result = await db.execute(
        select(Habit).where(
            (Habit.id == habit_id)
            & (Habit.user_id == current_user["sub"])
        )
    )
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")

    await db.delete(habit)
    await db.commit()


@router.post("/{habit_id}/log", response_model=HabitLogResponse, status_code=status.HTTP_201_CREATED)
async def log_habit(
    habit_id: str,
    log_data: HabitLogCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitLogResponse:
    """Log a habit completion."""
    result = await db.execute(
        select(Habit).where(
            (Habit.id == habit_id)
            & (Habit.user_id == current_user["sub"])
        )
    )
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")

    log = HabitLog(
        habit_id=habit_id,
        user_id=current_user["sub"],
        date=log_data.date,
        completed=log_data.completed,
        value=log_data.value,
        notes=log_data.notes,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return HabitLogResponse.from_orm(log)


@router.get("/grid/all", response_model=HabitsGridResponse)
async def get_habits_grid(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitsGridResponse:
    """Get GitHub-style habit grid."""
    result = await db.execute(
        select(Habit).where(Habit.user_id == current_user["sub"])
    )
    habits = result.scalars().all()

    start_date = date.today() - timedelta(days=days)
    end_date = date.today()

    grids = []
    for habit in habits:
        result = await db.execute(
            select(HabitLog).where(
                (HabitLog.habit_id == habit.id)
                & (HabitLog.date >= start_date)
                & (HabitLog.date <= end_date)
            )
        )
        logs = result.scalars().all()

        grid_data = {}
        current_date = start_date
        while current_date <= end_date:
            grid_data[current_date.isoformat()] = False
            current_date += timedelta(days=1)

        for log in logs:
            grid_data[log.date.isoformat()] = log.completed

        grids.append(HabitGridResponse(
            habit_id=habit.id,
            habit_name=habit.name,
            grid_data=grid_data,
        ))

    return HabitsGridResponse(
        habits=grids,
        date_range={"start": start_date, "end": end_date},
    )


@router.get("/streaks/all", response_model=HabitsStreaksResponse)
async def get_habits_streaks(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitsStreaksResponse:
    """Get streak information for all habits."""
    result = await db.execute(
        select(Habit).where(Habit.user_id == current_user["sub"])
    )
    habits = result.scalars().all()

    streaks = []
    for habit in habits:
        result = await db.execute(
            select(HabitLog)
            .where((HabitLog.habit_id == habit.id))
            .order_by(HabitLog.date.desc())
        )
        logs = result.scalars().all()

        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        last_completed = None

        for log in logs:
            if log.completed:
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
                if not last_completed:
                    last_completed = log.date
                    current_streak = temp_streak
            else:
                temp_streak = 0

        streaks.append(HabitStreakResponse(
            habit_id=habit.id,
            habit_name=habit.name,
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_completed=last_completed,
        ))

    return HabitsStreaksResponse(habits=streaks)
