"""Celery application configuration."""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "giuseppe-dashboard",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# ─── Celery Beat Schedule ────────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Sync calendari CalDAV ogni 15 minuti
    "sync-calendars-every-15-min": {
        "task": "app.tasks.periodic.sync_all_calendars",
        "schedule": crontab(minute=f"*/{settings.CALDAV_DEFAULT_SYNC_INTERVAL}"),
        "options": {"expires": 600},  # Expire after 10 min if not picked up
    },
    # Check deadline reminders ogni ora
    "check-deadline-reminders-hourly": {
        "task": "app.tasks.periodic.check_deadline_reminders",
        "schedule": crontab(minute=0),  # Every hour at :00
    },
    # Calcola focus scores a fine giornata
    "calculate-focus-scores-daily": {
        "task": "app.tasks.periodic.calculate_focus_scores",
        "schedule": crontab(hour=23, minute=55),  # 23:55 UTC
    },
    # Refresh feed cybersecurity ogni 2 ore
    "refresh-cyber-feed-every-2h": {
        "task": "app.tasks.periodic.refresh_cybersecurity_feed",
        "schedule": crontab(minute=0, hour="*/2"),
    },
    # Check medication reminders ogni 30 minuti
    "check-medication-reminders": {
        "task": "app.tasks.periodic.check_medication_reminders",
        "schedule": crontab(minute="0,30"),
    },
    # Check routine reminders ogni 30 minuti
    "check-routine-reminders": {
        "task": "app.tasks.periodic.check_routine_reminders",
        "schedule": crontab(minute="15,45"),
    },
}
