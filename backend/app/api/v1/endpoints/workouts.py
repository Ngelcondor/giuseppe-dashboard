"""Workout tracking endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from app.core.database import get_db
from app.core.security import require_editor
from app.core.sections import get_view_user_id
from app.models.health import Workout
from app.schemas.health import (
    WorkoutCreate,
    WorkoutResponse,
    WorkoutUpdate,
    WorkoutWeekSummary,
)

router = APIRouter(prefix="/health/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_data: WorkoutCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> WorkoutResponse:
    """Create a new workout."""
    workout = Workout(
        user_id=current_user["sub"],
        workout_type=workout_data.workout_type,
        intensity=workout_data.intensity,
        duration_minutes=workout_data.duration_minutes,
        calories_burned=workout_data.calories_burned,
        distance_km=workout_data.distance_km,
        avg_heart_rate=workout_data.avg_heart_rate,
        max_heart_rate=workout_data.max_heart_rate,
        notes=workout_data.notes,
        source=workout_data.source,
        started_at=workout_data.started_at,
        ended_at=workout_data.ended_at,
    )
    db.add(workout)
    await db.commit()
    await db.refresh(workout)
    return WorkoutResponse.from_orm(workout)


@router.get("", response_model=List[WorkoutResponse])
async def list_workouts(
    days: int = Query(30),
    workout_type: str = Query(None),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[WorkoutResponse]:
    """List workouts for the last N days."""
    start_date = datetime.utcnow() - timedelta(days=days)
    query = select(Workout).where(
        (Workout.user_id == view_user_id)
        & (Workout.started_at >= start_date)
    )

    if workout_type:
        query = query.where(Workout.workout_type == workout_type)

    query = query.order_by(Workout.started_at.desc())
    result = await db.execute(query)
    workouts = result.scalars().all()
    return [WorkoutResponse.from_orm(w) for w in workouts]


@router.get("/week-summary", response_model=WorkoutWeekSummary)
async def get_week_summary(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkoutWeekSummary:
    """Get weekly workout summary."""
    start_date = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(Workout)
        .where(
            (Workout.user_id == view_user_id)
            & (Workout.started_at >= start_date)
        )
        .order_by(Workout.started_at.desc())
    )
    workouts = result.scalars().all()
    workout_responses = [WorkoutResponse.from_orm(w) for w in workouts]

    if not workouts:
        return WorkoutWeekSummary(workouts=[])

    total_duration = sum(w.duration_minutes for w in workouts)
    total_calories = sum(w.calories_burned or 0 for w in workouts)
    total_distance = sum(w.distance_km or 0.0 for w in workouts)

    by_type: dict[str, int] = {}
    for w in workouts:
        t = w.workout_type.value
        by_type[t] = by_type.get(t, 0) + 1

    return WorkoutWeekSummary(
        workouts=workout_responses,
        total_workouts=len(workouts),
        total_duration_minutes=total_duration,
        total_calories=total_calories,
        total_distance_km=round(total_distance, 2),
        avg_duration_minutes=round(total_duration / len(workouts), 1),
        by_type=by_type,
    )


@router.get("/{workout_id}", response_model=WorkoutResponse)
async def get_workout(
    workout_id: str,
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkoutResponse:
    """Get a specific workout."""
    result = await db.execute(
        select(Workout).where(
            (Workout.id == workout_id)
            & (Workout.user_id == view_user_id)
        )
    )
    workout = result.scalars().first()
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    return WorkoutResponse.from_orm(workout)


@router.put("/{workout_id}", response_model=WorkoutResponse)
async def update_workout(
    workout_id: str,
    update_data: WorkoutUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> WorkoutResponse:
    """Update a workout."""
    result = await db.execute(
        select(Workout).where(
            (Workout.id == workout_id)
            & (Workout.user_id == current_user["sub"])
        )
    )
    workout = result.scalars().first()
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")

    data = update_data.dict(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(workout, field, value)

    db.add(workout)
    await db.commit()
    await db.refresh(workout)
    return WorkoutResponse.from_orm(workout)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a workout."""
    result = await db.execute(
        select(Workout).where(
            (Workout.id == workout_id)
            & (Workout.user_id == current_user["sub"])
        )
    )
    workout = result.scalars().first()
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")

    await db.delete(workout)
    await db.commit()
