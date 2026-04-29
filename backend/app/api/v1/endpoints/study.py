"""Study plan endpoints — sync per-task state across devices.

Auth disabled (matches habits_api / mood_api convention): a fixed DEFAULT_USER
is used until auth is re-enabled. The static study plan lives in the frontend;
this endpoint only persists user-mutable per-task state.
"""
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.study import StudyTaskState
from app.models.user import User
from app.schemas.study import StudyBatchEntry, StudyTaskStateOut, StudyTaskUpsert

router = APIRouter(prefix="/study", tags=["study"])

DEFAULT_USER = UUID("00000000-0000-0000-0000-000000000001")


async def _ensure_system_user(db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == DEFAULT_USER))
    if not result.scalars().first():
        db.add(User(
            id=DEFAULT_USER,
            email="system@dashboard.local",
            username="giuseppe",
            hashed_password="disabled",
            is_active=True,
            is_verified=True,
        ))
        await db.commit()


async def _get_or_create(db: AsyncSession, task_id: str) -> StudyTaskState:
    result = await db.execute(
        select(StudyTaskState).where(
            StudyTaskState.user_id == DEFAULT_USER,
            StudyTaskState.task_id == task_id,
        )
    )
    row = result.scalars().first()
    if row is None:
        row = StudyTaskState(user_id=DEFAULT_USER, task_id=task_id)
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
    result = await db.execute(
        select(StudyTaskState).where(StudyTaskState.user_id == DEFAULT_USER)
    )
    return list(result.scalars().all())


@router.put("/task/{task_id}", response_model=StudyTaskStateOut)
async def upsert_task(
    task_id: str,
    body: StudyTaskUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Upsert state for a single task."""
    await _ensure_system_user(db)
    row = await _get_or_create(db, task_id)
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
    await _ensure_system_user(db)
    out: List[StudyTaskState] = []
    for e in entries:
        row = await _get_or_create(db, e.task_id)
        _apply(row, StudyTaskUpsert(completed=e.completed, skipped=e.skipped, moved_to_date=e.moved_to_date))
        out.append(row)
    await db.commit()
    for row in out:
        await db.refresh(row)
    return out


@router.delete("/state", status_code=204)
async def reset_state(db: AsyncSession = Depends(get_db)):
    """Wipe all study task state for the current user."""
    await db.execute(
        delete(StudyTaskState).where(StudyTaskState.user_id == DEFAULT_USER)
    )
    await db.commit()
