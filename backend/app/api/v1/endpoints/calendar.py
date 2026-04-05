"""Calendar event endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.calendar_event import CalendarEvent
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
    CalendarUpcomingResponse,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: CalendarEventCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventResponse:
    """Create a calendar event."""
    cal_event = CalendarEvent(
        user_id=current_user["sub"],
        **event.dict(),
    )
    db.add(cal_event)
    await db.commit()
    await db.refresh(cal_event)
    return CalendarEventResponse.from_orm(cal_event)


@router.get("/events", response_model=List[CalendarEventResponse])
async def list_events(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CalendarEventResponse]:
    """List all calendar events."""
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == current_user["sub"])
        .order_by(CalendarEvent.start_time)
    )
    events = result.scalars().all()
    return [CalendarEventResponse.from_orm(e) for e in events]


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventResponse:
    """Get a specific event."""
    result = await db.execute(
        select(CalendarEvent).where(
            (CalendarEvent.id == event_id)
            & (CalendarEvent.user_id == current_user["sub"])
        )
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return CalendarEventResponse.from_orm(event)


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: str,
    event_update: CalendarEventUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventResponse:
    """Update an event."""
    result = await db.execute(
        select(CalendarEvent).where(
            (CalendarEvent.id == event_id)
            & (CalendarEvent.user_id == current_user["sub"])
        )
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = event_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(event, field, value)

    db.add(event)
    await db.commit()
    await db.refresh(event)
    return CalendarEventResponse.from_orm(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an event."""
    result = await db.execute(
        select(CalendarEvent).where(
            (CalendarEvent.id == event_id)
            & (CalendarEvent.user_id == current_user["sub"])
        )
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await db.delete(event)
    await db.commit()


@router.get("/upcoming", response_model=CalendarUpcomingResponse)
async def get_upcoming_events(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarUpcomingResponse:
    """Get upcoming events."""
    now = datetime.utcnow()
    next_7_days = now + timedelta(days=7)
    next_30_days = now + timedelta(days=30)

    # Events in next 7 days
    result = await db.execute(
        select(CalendarEvent).where(
            (CalendarEvent.user_id == current_user["sub"])
            & (CalendarEvent.start_time >= now)
            & (CalendarEvent.start_time <= next_7_days)
        )
    )
    events_7 = result.scalars().all()

    # Events in next 30 days
    result = await db.execute(
        select(CalendarEvent).where(
            (CalendarEvent.user_id == current_user["sub"])
            & (CalendarEvent.start_time >= next_7_days)
            & (CalendarEvent.start_time <= next_30_days)
        )
    )
    events_30 = result.scalars().all()

    return CalendarUpcomingResponse(
        next_7_days=[CalendarEventResponse.from_orm(e) for e in events_7],
        next_30_days=[CalendarEventResponse.from_orm(e) for e in events_30],
    )
