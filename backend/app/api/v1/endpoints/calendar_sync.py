"""CalDAV calendar connection and sync endpoints."""
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete

from app.core.crypto import decrypt_or_plain, encrypt_str
from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_event import CalendarEvent
from app.schemas.calendar_connection import (
    CalendarConnectionCreate,
    CalendarConnectionResponse,
    CalendarConnectionTestResponse,
    CalendarConnectionUpdate,
    CalendarSyncRequest,
    CalendarSyncResponse,
    CalDAVCalendarInfoSchema,
)
from app.services.caldav_service import (
    CalDAVService,
    CALDAV_PROVIDERS,
    sync_calendar_events,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar/connections", tags=["calendar-sync"])


# ─── Connection Management ──────────────────────────────────────────────────


@router.post(
    "",
    response_model=CalendarConnectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_connection(
    data: CalendarConnectionCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CalendarConnectionResponse:
    """
    Crea una nuova connessione CalDAV (Apple Calendar, Google, Nextcloud, ecc.).

    Per Apple Calendar:
    - provider: "apple"
    - username: il tuo Apple ID (email)
    - app_password: password specifica per le app (generata su appleid.apple.com)
    """
    # Resolve CalDAV URL
    caldav_url = data.caldav_url
    if not caldav_url:
        caldav_url = CALDAV_PROVIDERS.get(data.provider)
        if not caldav_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider '{data.provider}' richiede un caldav_url esplicito.",
            )

    # Test the connection first
    service = CalDAVService(url=caldav_url, username=data.username, password=data.app_password)
    test_result = service.test_connection()

    if not test_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=test_result.get("message", "Connessione CalDAV fallita."),
        )

    # Save connection
    connection = CalendarConnection(
        user_id=current_user["sub"],
        provider=data.provider,
        display_name=data.display_name,
        caldav_url=caldav_url,
        username=data.username,
        app_password=encrypt_str(data.app_password),
        is_active=True,
        sync_interval_minutes=data.sync_interval_minutes,
    )

    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    return CalendarConnectionResponse.from_orm(connection)


@router.get("", response_model=List[CalendarConnectionResponse])
async def list_connections(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CalendarConnectionResponse]:
    """Elenca tutte le connessioni CalDAV dell'utente."""
    result = await db.execute(
        select(CalendarConnection)
        .where(CalendarConnection.user_id == current_user["sub"])
        .order_by(CalendarConnection.created_at.desc())
    )
    connections = result.scalars().all()
    return [CalendarConnectionResponse.from_orm(c) for c in connections]


@router.get("/{connection_id}", response_model=CalendarConnectionResponse)
async def get_connection(
    connection_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarConnectionResponse:
    """Dettaglio di una connessione CalDAV."""
    connection = await _get_user_connection(connection_id, current_user["sub"], db)
    return CalendarConnectionResponse.from_orm(connection)


@router.patch("/{connection_id}", response_model=CalendarConnectionResponse)
async def update_connection(
    connection_id: str,
    data: CalendarConnectionUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CalendarConnectionResponse:
    """Aggiorna una connessione CalDAV."""
    connection = await _get_user_connection(connection_id, current_user["sub"], db)

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if field == "app_password":
                value = encrypt_str(value)
            setattr(connection, field, value)

    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    return CalendarConnectionResponse.from_orm(connection)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Elimina una connessione CalDAV e tutti gli eventi sincronizzati."""
    connection = await _get_user_connection(connection_id, current_user["sub"], db)

    # Delete synced events from this connection
    await db.execute(
        sa_delete(CalendarEvent).where(
            (CalendarEvent.user_id == current_user["sub"])
            & (CalendarEvent.source == connection.provider)
        )
    )

    await db.delete(connection)
    await db.commit()


# ─── Test & Discovery ────────────────────────────────────────────────────────


@router.post("/{connection_id}/test", response_model=CalendarConnectionTestResponse)
async def test_connection(
    connection_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CalendarConnectionTestResponse:
    """Testa una connessione CalDAV esistente."""
    connection = await _get_user_connection(connection_id, current_user["sub"], db)

    service = CalDAVService(
        url=connection.caldav_url,
        username=connection.username,
        password=decrypt_or_plain(connection.app_password),
    )
    result = service.test_connection()

    return CalendarConnectionTestResponse(
        success=result["success"],
        calendars_count=result.get("calendars_count"),
        calendars=[
            CalDAVCalendarInfoSchema(
                calendar_id=c.calendar_id,
                name=c.name,
                color=c.color,
            )
            for c in result.get("calendars", [])
        ]
        if result["success"]
        else None,
        error=result.get("error"),
        message=result.get("message"),
    )


@router.get("/{connection_id}/calendars", response_model=List[CalDAVCalendarInfoSchema])
async def list_remote_calendars(
    connection_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CalDAVCalendarInfoSchema]:
    """Lista i calendari disponibili sul server CalDAV remoto."""
    connection = await _get_user_connection(connection_id, current_user["sub"], db)

    service = CalDAVService(
        url=connection.caldav_url,
        username=connection.username,
        password=decrypt_or_plain(connection.app_password),
    )

    try:
        calendars = service.list_calendars()
        return [
            CalDAVCalendarInfoSchema(
                calendar_id=c.calendar_id,
                name=c.name,
                color=c.color,
                description=c.description,
            )
            for c in calendars
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Errore nel recupero dei calendari: {str(e)}",
        )


# ─── Sync ────────────────────────────────────────────────────────────────────


@router.post("/{connection_id}/sync", response_model=CalendarSyncResponse)
async def trigger_sync(
    connection_id: str,
    sync_req: Optional[CalendarSyncRequest] = None,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CalendarSyncResponse:
    """
    Esegui la sincronizzazione degli eventi da un calendario CalDAV.

    Scarica gli eventi dal server remoto e li salva nel database locale,
    aggiornando quelli esistenti e creando quelli nuovi.
    """
    connection = await _get_user_connection(connection_id, current_user["sub"], db)

    if not connection.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questa connessione è disattivata.",
        )

    # Parse calendar filter
    calendar_ids = None
    days_back = 7
    days_forward = 90

    if sync_req:
        calendar_ids = sync_req.calendar_ids
        days_back = sync_req.days_back
        days_forward = sync_req.days_forward

    if not calendar_ids and connection.calendars_filter:
        try:
            calendar_ids = json.loads(connection.calendars_filter)
        except (json.JSONDecodeError, TypeError):
            pass

    # Execute sync
    result = await sync_calendar_events(
        user_id=str(current_user["sub"]),
        connection_id=str(connection.id),
        caldav_url=connection.caldav_url,
        username=connection.username,
        password=decrypt_or_plain(connection.app_password),
        calendar_ids=calendar_ids,
        days_back=days_back,
        days_forward=days_forward,
    )

    # Process events into database
    events_created = 0
    events_updated = 0

    if result["success"]:
        for caldav_event in result["events"]:
            # Check if event already exists by external_id
            existing = await db.execute(
                select(CalendarEvent).where(
                    (CalendarEvent.user_id == current_user["sub"])
                    & (CalendarEvent.external_id == caldav_event.uid)
                )
            )
            existing_event = existing.scalars().first()

            if existing_event:
                # Update existing event
                existing_event.title = caldav_event.summary
                existing_event.description = caldav_event.description
                existing_event.start_time = caldav_event.dtstart
                existing_event.end_time = caldav_event.dtend
                existing_event.location = caldav_event.location
                existing_event.is_all_day = caldav_event.all_day
                existing_event.calendar_name = caldav_event.calendar_name
                existing_event.color = caldav_event.calendar_color or "#3B82F6"
                existing_event.synced_at = datetime.utcnow()
                db.add(existing_event)
                events_updated += 1
            else:
                # Create new event
                new_event = CalendarEvent(
                    user_id=current_user["sub"],
                    title=caldav_event.summary,
                    description=caldav_event.description,
                    start_time=caldav_event.dtstart,
                    end_time=caldav_event.dtend,
                    location=caldav_event.location,
                    source=connection.provider,
                    calendar_name=caldav_event.calendar_name,
                    color=caldav_event.calendar_color or "#3B82F6",
                    is_all_day=caldav_event.all_day,
                    external_id=caldav_event.uid,
                    synced_at=datetime.utcnow(),
                )
                db.add(new_event)
                events_created += 1

        await db.commit()

        # Update connection sync status
        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_status = "success"
        connection.last_sync_error = None
        db.add(connection)
        await db.commit()
    else:
        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_status = "error"
        connection.last_sync_error = result.get("error", "Unknown error")
        db.add(connection)
        await db.commit()

    return CalendarSyncResponse(
        success=result["success"],
        events_synced=events_created + events_updated,
        events_created=events_created,
        events_updated=events_updated,
        events_deleted=0,
        error=result.get("error"),
        sync_range=result.get("sync_range"),
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────


async def _get_user_connection(
    connection_id: str, user_id: str, db: AsyncSession
) -> CalendarConnection:
    """Get a calendar connection belonging to the user, or 404."""
    result = await db.execute(
        select(CalendarConnection).where(
            (CalendarConnection.id == connection_id)
            & (CalendarConnection.user_id == user_id)
        )
    )
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connessione calendario non trovata.",
        )
    return connection
