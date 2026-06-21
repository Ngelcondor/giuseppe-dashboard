"""Deadline endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, datetime
from typing import List

from dateutil.relativedelta import relativedelta

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.deadline import (
    Deadline,
    RecurrenceType,
    RecurrenceInterval,
)
from app.schemas.deadline import (
    DeadlineCreate,
    DeadlineResponse,
    DeadlineUpdate,
    DeadlineUpcomingResponse,
    DeadlineCompleteRequest,
    DeadlineOccurrence,
    DeadlineOccurrencesResponse,
)

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


# Step (in months) between two consecutive subscription periods.
_INTERVAL_MONTHS = {
    RecurrenceInterval.MONTHLY: 1,
    RecurrenceInterval.QUARTERLY: 3,
    RecurrenceInterval.YEARLY: 12,
}


@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
async def create_deadline(
    deadline: DeadlineCreate,
    current_user: dict = Depends(require_editor),
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
    current_user: dict = Depends(require_editor),
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
    current_user: dict = Depends(require_editor),
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
    current_user: dict = Depends(require_editor),
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


def _expand_occurrences(d: Deadline, today: date, horizon_end: date) -> List[DeadlineOccurrence]:
    """Compute (without persisting) the occurrences of one deadline that fall
    within [today, horizon_end].

    - none: the single deadline itself, if not completed and within horizon.
    - installments: the remaining UNPAID rate. Rata k falls on due_date + (k-1)
      intervals. With no explicit interval we space rate one month apart.
    - subscription: every period from due_date forward that lands in the window.
    """
    rec = d.recurrence_type or RecurrenceType.NONE
    out: List[DeadlineOccurrence] = []

    def _make(when: date, index=None, total=None) -> DeadlineOccurrence:
        return DeadlineOccurrence(
            deadline_id=d.id,
            title=d.title,
            category=d.category,
            priority=d.priority,
            recurrence_type=rec,
            date=when,
            amount=d.amount,
            occurrence_index=index,
            occurrence_total=total,
        )

    if rec == RecurrenceType.INSTALLMENTS:
        total = d.installments_total or 0
        paid = d.installments_paid or 0
        if total <= 0:
            return out
        # Rate are spaced one month apart starting at due_date.
        for k in range(paid + 1, total + 1):  # 1-based remaining rate
            when = d.due_date + relativedelta(months=(k - 1))
            if when > horizon_end:
                break
            out.append(_make(when, index=k, total=total))
        return out

    if rec == RecurrenceType.SUBSCRIPTION:
        step = _INTERVAL_MONTHS.get(d.recurrence_interval or RecurrenceInterval.MONTHLY, 1)
        # Walk forward from the anchor date until we leave the window. Cap the
        # iteration count so a far-past anchor can't loop unboundedly.
        when = d.due_date
        guard = 0
        while when < today and guard < 1200:
            when = when + relativedelta(months=step)
            guard += 1
        while when <= horizon_end and guard < 1200:
            out.append(_make(when))
            when = when + relativedelta(months=step)
            guard += 1
        return out

    # none / one-off
    if not d.is_completed and today <= d.due_date <= horizon_end:
        out.append(_make(d.due_date))
    return out


@router.get("/occurrences/upcoming", response_model=DeadlineOccurrencesResponse)
async def get_upcoming_occurrences(
    months: int = Query(6, ge=1, le=36),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeadlineOccurrencesResponse:
    """Return upcoming occurrences EXPANDED for the next N months.

    Subscriptions are expanded into their recurring dates and installments into
    their remaining unpaid dates. Nothing is persisted — occurrences are
    computed on the fly.
    """
    today = date.today()
    horizon_end = today + relativedelta(months=months)

    result = await db.execute(
        select(Deadline).where(Deadline.user_id == current_user["sub"])
    )
    deadlines = result.scalars().all()

    occurrences: List[DeadlineOccurrence] = []
    for d in deadlines:
        occurrences.extend(_expand_occurrences(d, today, horizon_end))

    occurrences.sort(key=lambda o: o.date)
    return DeadlineOccurrencesResponse(
        months=months,
        horizon_end=horizon_end,
        occurrences=occurrences,
    )


@router.patch("/{deadline_id}/pay-installment", response_model=DeadlineResponse)
async def pay_next_installment(
    deadline_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> DeadlineResponse:
    """Mark the next rata of an installment deadline as paid.

    Increments installments_paid; once all rate are paid the deadline is also
    flagged completed.
    """
    result = await db.execute(
        select(Deadline).where(
            (Deadline.id == deadline_id)
            & (Deadline.user_id == current_user["sub"])
        )
    )
    deadline = result.scalars().first()
    if not deadline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    if deadline.recurrence_type != RecurrenceType.INSTALLMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deadline is not an installment plan",
        )

    total = deadline.installments_total or 0
    paid = deadline.installments_paid or 0
    if paid >= total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All installments already paid",
        )

    deadline.installments_paid = paid + 1
    if deadline.installments_paid >= total:
        deadline.is_completed = True
        deadline.completed_at = datetime.utcnow()

    db.add(deadline)
    await db.commit()
    await db.refresh(deadline)
    return DeadlineResponse.from_orm(deadline)
