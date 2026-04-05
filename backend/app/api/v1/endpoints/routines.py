"""Routine endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.routine import Routine, RoutineStep, RoutineLog, TimeOfDay
from app.schemas.routine import (
    RoutineCreate, RoutineResponse, RoutineUpdate,
    RoutineStepCreate, RoutineStepResponse, RoutineStepUpdate,
    RoutineLogCreate, RoutineLogResponse,
    RoutineStartRequest, RoutineCompleteRequest,
    RoutineTodayResponse,
)

router = APIRouter(prefix="/routines", tags=["routines"])


@router.post("", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
async def create_routine(
    routine: RoutineCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineResponse:
    """Create a routine."""
    new_routine = Routine(
        user_id=current_user["sub"],
        name=routine.name,
        description=routine.description,
        time_of_day=routine.time_of_day,
        is_active=routine.is_active,
        order=routine.order,
    )
    db.add(new_routine)
    await db.flush()

    for step in routine.steps:
        routine_step = RoutineStep(
            routine_id=new_routine.id,
            **step.dict(),
        )
        db.add(routine_step)

    await db.commit()
    await db.refresh(new_routine)
    return RoutineResponse.from_orm(new_routine)


@router.get("", response_model=List[RoutineResponse])
async def list_routines(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[RoutineResponse]:
    """List all routines."""
    result = await db.execute(
        select(Routine)
        .where(Routine.user_id == current_user["sub"])
        .order_by(Routine.order)
    )
    routines = result.scalars().all()
    return [RoutineResponse.from_orm(r) for r in routines]


@router.get("/{routine_id}", response_model=RoutineResponse)
async def get_routine(
    routine_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineResponse:
    """Get a specific routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")
    return RoutineResponse.from_orm(routine)


@router.put("/{routine_id}", response_model=RoutineResponse)
async def update_routine(
    routine_id: str,
    routine_update: RoutineUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineResponse:
    """Update a routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    update_data = routine_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(routine, field, value)

    db.add(routine)
    await db.commit()
    await db.refresh(routine)
    return RoutineResponse.from_orm(routine)


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
    routine_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    await db.delete(routine)
    await db.commit()


@router.post("/{routine_id}/steps", response_model=RoutineStepResponse, status_code=status.HTTP_201_CREATED)
async def add_routine_step(
    routine_id: str,
    step: RoutineStepCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineStepResponse:
    """Add a step to a routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    routine_step = RoutineStep(routine_id=routine_id, **step.dict())
    db.add(routine_step)
    await db.commit()
    await db.refresh(routine_step)
    return RoutineStepResponse.from_orm(routine_step)


@router.get("/today/all", response_model=RoutineTodayResponse)
async def get_today_routines(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineTodayResponse:
    """Get routines for today."""
    result = await db.execute(
        select(Routine).where(
            (Routine.user_id == current_user["sub"])
            & (Routine.is_active == True)
        )
    )
    routines = result.scalars().all()

    today_routines = {
        "morning": None,
        "afternoon": None,
        "evening": None,
        "night": None,
    }

    for routine in routines:
        time_key = routine.time_of_day.value
        if time_key in today_routines:
            today_routines[time_key] = RoutineResponse.from_orm(routine)

    return RoutineTodayResponse(**today_routines)


@router.post("/{routine_id}/start", response_model=RoutineLogResponse, status_code=status.HTTP_201_CREATED)
async def start_routine(
    routine_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineLogResponse:
    """Start a routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    log = RoutineLog(
        routine_id=routine_id,
        user_id=current_user["sub"],
        started_at=datetime.utcnow(),
        completed_steps=[],
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return RoutineLogResponse.from_orm(log)


@router.post("/{routine_id}/complete", response_model=RoutineLogResponse)
async def complete_routine(
    routine_id: str,
    request: RoutineCompleteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineLogResponse:
    """Complete a routine."""
    result = await db.execute(
        select(Routine).where(
            (Routine.id == routine_id)
            & (Routine.user_id == current_user["sub"])
        )
    )
    routine = result.scalars().first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    log = RoutineLog(
        routine_id=routine_id,
        user_id=current_user["sub"],
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        completed_steps=request.completed_steps,
        notes=request.notes,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return RoutineLogResponse.from_orm(log)
