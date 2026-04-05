"""Deadline endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, datetime
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.deadline import Deadline
from app.schemas.deadline import (
    DeadlineCreate,
    DeadlineResponse,
    DeadlineUpdate,
    DeadlineUpcomingResponse,
    DeadlineCompleteRequest,
)

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
async def create_deadline(
    deadline: DeadlineCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineResponse:
    """Create a deadline."""
    new_deadline = Deadline(
        user_id=current_user["sub"],
        **deadline.dict(),
    )
    db.add(new_deadline)
    await db.commit()
    await db.refresh(new_deadline)
    return DeadlineResponse.from_orm(new_deadline)


@router.get("", response_model=List[DeadlineResponse])
async def list_deadlines(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DeadlineResponse]:
    """List all deadlines."""
    result = await db.execute(
        select(Deadline)
        .where(Deadline.user_id == current_user["sub"])
        .order_by(Deadline.due_date)
    )
    deadlines = result.scalars().all()
    return [DeadlineResponse.from_orm(d) for d in deadlines]


@router.get("/{deadline_id}", response_model=DeadlineResponse)
async def get_deadline(
    deadline_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineResponse:
    """Get a specific deadline."""
    result = await db.execute(
        select(Deadline).where(
            (Deadline.id == deadline_id)
            & (Deadline.user_id == current_user["sub"])
        )
    )
    deadline = result.scalars().first()
    if not deadline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")
    return DeadlineResponse.from_orm(deadline)


@router.put("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: str,
    deadline_update: DeadlineUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineResponse:
    """Update a deadline."""
    result = await db.execute(
        select(Deadline).where(
            (Deadline.id == deadline_id)
            & (Deadline.user_id == current_user["sub"])
        )
    )
    deadline = result.scalars().first()
    if not deadline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    update_data = deadline_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(deadline, field, value)

    db.add(deadline)
    await db.commit()
    await db.refresh(deadline)
    return DeadlineResponse.from_orm(deadline)


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline(
    deadline_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a deadline."""
    result = await db.execute(
        select(Deadline).where(
            (Deadline.id == deadline_id)
            & (Deadline.user_id == current_user["sub"])
        )
    )
    deadline = result.scalars().first()
    if not deadline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    await db.delete(deadline)
    await db.commit()


@router.get("/upcoming/list", response_model=DeadlineUpcomingResponse)
async def get_upcoming_deadlines(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineUpcomingResponse:
    """Get upcoming and overdue deadlines."""
    today = date.today()

    # Upcoming
    result = await db.execute(
        select(Deadline).where(
            (Deadline.user_id == current_user["sub"])
            & (Deadline.due_date >= today)
            & (Deadline.is_completed == False)
        )
    )
    upcoming = result.scalars().all()

    # Overdue
    result = await db.execute(
        select(Deadline).where(
            (Deadline.user_id == current_user["sub"])
            & (Deadline.due_date < today)
            & (Deadline.is_completed == False)
        )
    )
    overdue = result.scalars().all()

    return DeadlineUpcomingResponse(
        upcoming=[DeadlineResponse.from_orm(d) for d in upcoming],
        overdue=[DeadlineResponse.from_orm(d) for d in overdue],
    )


@router.patch("/{deadline_id}/complete", response_model=DeadlineResponse)
async def complete_deadline(
    deadline_id: str,
    request: DeadlineCompleteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineResponse:
    """Mark deadline as complete."""
    result = await db.execute(
        select(Deadline).where(
            (Deadline.id == deadline_id)
            & (Deadline.user_id == current_user["sub"])
        )
    )
    deadline = result.scalars().first()
    if not deadline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    deadline.is_completed = True
    deadline.completed_at = datetime.utcnow()
    deadline.completion_notes = request.completion_notes

    db.add(deadline)
    await db.commit()
    await db.refresh(deadline)
    return DeadlineResponse.from_orm(deadline)
