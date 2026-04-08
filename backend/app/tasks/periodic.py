"""Periodic background tasks.

NOTE: Celery does not natively support async tasks.
All task functions are synchronous and use asyncio.run() to call
the underlying async logic.
"""
import asyncio
from datetime import date, datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

import logging

from app.core.config import settings
from app.models.user import User
from app.models.deadline import Deadline
from app.models.medication import Medication
from app.models.routine import Routine
from app.models.calendar_connection import CalendarConnection
from app.models.calendar_event import CalendarEvent
from app.services.notification_service import (
    send_reminder,
    send_medication_reminder,
    send_routine_reminder,
)
from app.services.focus_calculator import calculate_daily_focus_score
from app.services.feed_service import fetch_cybersecurity_feed
from app.services.weather_service import get_weather
from app.services.caldav_service import sync_calendar_events
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    return asyncio.run(coro)


@celery_app.task
def check_deadline_reminders():
    """Check for upcoming deadline reminders."""

    async def _inner():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as db:
            today = date.today()

            result = await db.execute(select(User))
            users = result.scalars().all()

            for user in users:
                result = await db.execute(
                    select(Deadline).where(
                        (Deadline.user_id == user.id)
                        & (Deadline.is_completed == False)
                    )
                )
                deadlines = result.scalars().all()

                for deadline in deadlines:
                    days_until = (deadline.due_date - today).days
                    if days_until == deadline.reminder_days_before:
                        await send_reminder(str(user.id), deadline.title, deadline.due_date)

        await engine.dispose()

    _run_async(_inner())


@celery_app.task
def calculate_focus_scores():
    """Calculate daily focus scores for all users."""

    async def _inner():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as db:
            today = date.today()

            result = await db.execute(select(User))
            users = result.scalars().all()

            for user in users:
                score_data = await calculate_daily_focus_score(str(user.id), today, db)
                if score_data:
                    pass

        await engine.dispose()

    _run_async(_inner())


@celery_app.task
def refresh_cybersecurity_feed():
    """Refresh cybersecurity news feed."""
    _run_async(fetch_cybersecurity_feed())


@celery_app.task
def check_medication_reminders():
    """Check for medication reminders."""

    async def _inner():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as db:
            result = await db.execute(
                select(Medication).where(Medication.is_active == True)
            )
            medications = result.scalars().all()

            for medication in medications:
                await send_medication_reminder(
                    str(medication.user_id),
                    medication.name,
                    medication.time_of_day,
                )

        await engine.dispose()

    _run_async(_inner())


@celery_app.task
def check_routine_reminders():
    """Check for routine reminders."""

    async def _inner():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as db:
            result = await db.execute(
                select(Routine).where(Routine.is_active == True)
            )
            routines = result.scalars().all()

            for routine in routines:
                await send_routine_reminder(
                    str(routine.user_id),
                    routine.name,
                    routine.time_of_day.value,
                )

        await engine.dispose()

    _run_async(_inner())


# ─── Calendar Sync Tasks ────────────────────────────────────────────────────


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_all_calendars(self):
    """
    Sincronizza tutti i calendari CalDAV attivi.

    Eseguito periodicamente via Celery Beat.
    Per ogni connessione attiva, scarica gli eventi dal server CalDAV
    e aggiorna il database locale.
    """

    async def _inner():
        if not settings.CALDAV_SYNC_ENABLED:
            logger.info("CalDAV sync disabilitata, skip.")
            return {"skipped": True, "reason": "sync_disabled"}

        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        results = {
            "total_connections": 0,
            "synced": 0,
            "failed": 0,
            "events_total": 0,
            "details": [],
        }

        async with async_session() as db:
            result = await db.execute(
                select(CalendarConnection).where(CalendarConnection.is_active == True)
            )
            connections = result.scalars().all()
            results["total_connections"] = len(connections)

            for connection in connections:
                try:
                    calendar_ids = None
                    if connection.calendars_filter:
                        import json
                        try:
                            calendar_ids = json.loads(connection.calendars_filter)
                        except (json.JSONDecodeError, TypeError):
                            pass

                    sync_result = await sync_calendar_events(
                        user_id=str(connection.user_id),
                        connection_id=str(connection.id),
                        caldav_url=connection.caldav_url,
                        username=connection.username,
                        password=connection.app_password,
                        calendar_ids=calendar_ids,
                        days_back=settings.CALDAV_SYNC_DAYS_BACK,
                        days_forward=settings.CALDAV_SYNC_DAYS_FORWARD,
                    )

                    if sync_result["success"]:
                        events_created = 0
                        events_updated = 0

                        for caldav_event in sync_result["events"]:
                            existing = await db.execute(
                                select(CalendarEvent).where(
                                    (CalendarEvent.user_id == connection.user_id)
                                    & (CalendarEvent.external_id == caldav_event.uid)
                                )
                            )
                            existing_event = existing.scalars().first()

                            if existing_event:
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
                                new_event = CalendarEvent(
                                    user_id=connection.user_id,
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

                        connection.last_sync_at = datetime.utcnow()
                        connection.last_sync_status = "success"
                        connection.last_sync_error = None
                        db.add(connection)
                        await db.commit()

                        total = events_created + events_updated
                        results["synced"] += 1
                        results["events_total"] += total
                        results["details"].append({
                            "connection_id": str(connection.id),
                            "provider": connection.provider,
                            "status": "success",
                            "events_created": events_created,
                            "events_updated": events_updated,
                        })

                        logger.info(
                            f"Calendar sync OK: {connection.provider} ({connection.display_name}) "
                            f"- {events_created} created, {events_updated} updated"
                        )
                    else:
                        connection.last_sync_at = datetime.utcnow()
                        connection.last_sync_status = "error"
                        connection.last_sync_error = sync_result.get("error", "Unknown error")
                        db.add(connection)
                        await db.commit()

                        results["failed"] += 1
                        results["details"].append({
                            "connection_id": str(connection.id),
                            "provider": connection.provider,
                            "status": "error",
                            "error": sync_result.get("error"),
                        })

                        logger.warning(
                            f"Calendar sync FAILED: {connection.provider} ({connection.display_name}) "
                            f"- {sync_result.get('error')}"
                        )

                except Exception as e:
                    results["failed"] += 1
                    results["details"].append({
                        "connection_id": str(connection.id),
                        "provider": connection.provider,
                        "status": "exception",
                        "error": str(e),
                    })
                    logger.error(
                        f"Calendar sync EXCEPTION: {connection.provider} ({connection.display_name}) - {e}",
                        exc_info=True,
                    )

        await engine.dispose()

        logger.info(
            f"Calendar sync complete: {results['synced']}/{results['total_connections']} OK, "
            f"{results['failed']} failed, {results['events_total']} events total"
        )
        return results

    return _run_async(_inner())


@celery_app.task
def sync_single_calendar(connection_id: str):
    """
    Sincronizza un singolo calendario CalDAV.

    Utile per trigger manuali o retry di connessioni specifiche.

    Args:
        connection_id: UUID della CalendarConnection.
    """

    async def _inner():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as db:
            result = await db.execute(
                select(CalendarConnection).where(CalendarConnection.id == connection_id)
            )
            connection = result.scalars().first()

            if not connection:
                logger.error(f"Connection {connection_id} not found")
                return {"success": False, "error": "connection_not_found"}

            if not connection.is_active:
                logger.info(f"Connection {connection_id} is inactive, skipping")
                return {"success": False, "error": "connection_inactive"}

            calendar_ids = None
            if connection.calendars_filter:
                import json
                try:
                    calendar_ids = json.loads(connection.calendars_filter)
                except (json.JSONDecodeError, TypeError):
                    pass

            sync_result = await sync_calendar_events(
                user_id=str(connection.user_id),
                connection_id=str(connection.id),
                caldav_url=connection.caldav_url,
                username=connection.username,
                password=connection.app_password,
                calendar_ids=calendar_ids,
                days_back=settings.CALDAV_SYNC_DAYS_BACK,
                days_forward=settings.CALDAV_SYNC_DAYS_FORWARD,
            )

            if sync_result["success"]:
                events_created = 0
                events_updated = 0

                for caldav_event in sync_result["events"]:
                    existing = await db.execute(
                        select(CalendarEvent).where(
                            (CalendarEvent.user_id == connection.user_id)
                            & (CalendarEvent.external_id == caldav_event.uid)
                        )
                    )
                    existing_event = existing.scalars().first()

                    if existing_event:
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
                        new_event = CalendarEvent(
                            user_id=connection.user_id,
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

                connection.last_sync_at = datetime.utcnow()
                connection.last_sync_status = "success"
                connection.last_sync_error = None
                db.add(connection)
                await db.commit()

                logger.info(
                    f"Single sync OK: {connection.provider} - "
                    f"{events_created} created, {events_updated} updated"
                )
                return {
                    "success": True,
                    "events_created": events_created,
                    "events_updated": events_updated,
                }
            else:
                connection.last_sync_at = datetime.utcnow()
                connection.last_sync_status = "error"
                connection.last_sync_error = sync_result.get("error")
                db.add(connection)
                await db.commit()

                return {"success": False, "error": sync_result.get("error")}

        await engine.dispose()

    return _run_async(_inner())
