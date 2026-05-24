"""Study plan endpoints — sync per-task state across devices.

Authenticated. We reuse the admin user (created by seed_admin_user at startup)
as the single owner of all study state, since this is a personal dashboard.
The static study plan lives in the frontend; this endpoint only persists
user-mutable per-task state.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.study import StudyTaskState
from app.models.user import User
from app.schemas.study import StudyBatchEntry, StudyTaskStateOut, StudyTaskUpsert

router = APIRouter(
    prefix="/study",
    tags=["study"],
    dependencies=[Depends(get_current_user)],
)

_cached_user_id: Optional[UUID] = None


async def _get_user_id(db: AsyncSession) -> UUID:
    """Return the UUID of the single dashboard user. Cached after first lookup."""
    global _cached_user_id
    if _cached_user_id is not None:
        return _cached_user_id
    result = await db.execute(select(User).order_by(User.created_at).limit(1))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(503, "No user in database — admin seed has not run yet")
    _cached_user_id = user.id
    return _cached_user_id


async def _get_or_create(db: AsyncSession, user_id: UUID, task_id: str) -> StudyTaskState:
    result = await db.execute(
        select(StudyTaskState).where(
            StudyTaskState.user_id == user_id,
            StudyTaskState.task_id == task_id,
        )
    )
    row = result.scalars().first()
    if row is None:
        row = StudyTaskState(user_id=user_id, task_id=task_id)
        db.add(row)
    return row


def _apply(row: StudyTaskState, upd: StudyTaskUpsert) -> None:
    if upd.completed is not None:
        row.completed = upd.completed
        row.completed_at = datetime.utcnow() if upd.completed else None
        if upd.completed:
            row.skipped = False
    if upd.skipped is not None:
        row.skipped = upd.skipped
        if upd.skipped:
            row.completed = False
            row.completed_at = None
    if upd.moved_to_date is not None:
        row.moved_to_date = upd.moved_to_date or None  # empty string clears


@router.get("/state", response_model=List[StudyTaskStateOut])
async def get_state(db: AsyncSession = Depends(get_db)):
    """Return all task states for the current user."""
    user_id = await _get_user_id(db)
    result = await db.execute(
        select(StudyTaskState).where(StudyTaskState.user_id == user_id)
    )
    return list(result.scalars().all())


@router.put("/task/{task_id}", response_model=StudyTaskStateOut)
async def upsert_task(
    task_id: str,
    body: StudyTaskUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Upsert state for a single task."""
    user_id = await _get_user_id(db)
    row = await _get_or_create(db, user_id, task_id)
    _apply(row, body)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/state/batch", response_model=List[StudyTaskStateOut])
async def upsert_batch(
    entries: List[StudyBatchEntry],
    db: AsyncSession = Depends(get_db),
):
    """Bulk upsert — used for reschedule operations that touch many tasks at once."""
    user_id = await _get_user_id(db)
    out: List[StudyTaskState] = []
    for e in entries:
        row = await _get_or_create(db, user_id, e.task_id)
        _apply(row, StudyTaskUpsert(completed=e.completed, skipped=e.skipped, moved_to_date=e.moved_to_date))
        out.append(row)
    await db.commit()
    for row in out:
        await db.refresh(row)
    return out


@router.delete("/state", status_code=204)
async def reset_state(db: AsyncSession = Depends(get_db)):
    """Wipe all study task state for the current user."""
    user_id = await _get_user_id(db)
    await db.execute(
        delete(StudyTaskState).where(StudyTaskState.user_id == user_id)
    )
    await db.commit()
