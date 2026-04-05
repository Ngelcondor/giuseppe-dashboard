"""Notification service with Web Push support."""
import os
import json
import logging
from typing import Optional
from datetime import datetime, date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.notification import PushSubscription, Notification

logger = logging.getLogger(__name__)


async def _create_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    icon: str | None = None,
    link: str | None = None,
) -> Notification:
    """Create a notification in the database."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        icon=icon,
        link=link,
    )
    db.add(notif)
    await db.flush()
    return notif


async def _send_push_to_user(
    db: AsyncSession,
    user_id: str,
    payload: dict,
) -> int:
    """Send push notification to all user subscriptions. Returns count sent."""
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "")
    vapid_public_key = os.getenv("VAPID_PUBLIC_KEY", "")

    if not vapid_private_key or not vapid_public_key:
        logger.debug("VAPID keys not configured, skipping push")
        return 0

    result = await db.execute(
        select(PushSubscription).where(
            (PushSubscription.user_id == user_id)
            & (PushSubscription.is_active == True)
        )
    )
    subscriptions = result.scalars().all()

    if not subscriptions:
        return 0

    sent = 0
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed, skipping push")
        return 0

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key,
                    },
                },
                data=json.dumps(payload),
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": "mailto:dashboard@giuseppe.dev"},
            )
            sent += 1
        except Exception as e:
            logger.error(f"Push failed for subscription {sub.id}: {e}")
            # Deactivate invalid subscriptions
            if "410" in str(e) or "404" in str(e):
                sub.is_active = False
                db.add(sub)

    return sent


async def send_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    icon: str | None = None,
    link: str | None = None,
    push: bool = True,
) -> bool:
    """
    Send a notification to user (saves to DB + push).
    """
    # Save to DB
    notif = await _create_notification(
        db, user_id, title, message, notification_type, icon, link
    )

    # Send push
    if push:
        sent = await _send_push_to_user(db, user_id, {
            "title": title,
            "body": message,
            "type": notification_type,
            "icon": icon,
            "url": link or "/dashboard",
            "tag": notification_type,
        })
        if sent > 0:
            notif.is_pushed = True
            db.add(notif)

    await db.commit()
    return True


async def send_reminder(
    db: AsyncSession,
    user_id: str,
    deadline_title: str,
    due_date: date,
) -> bool:
    """Send deadline reminder notification."""
    days_until = (due_date - date.today()).days
    title = f"Scadenza: {deadline_title}"
    message = f"Mancano {days_until} giorni"
    notification_type = "warning" if days_until <= 1 else "deadline"

    return await send_notification(
        db, user_id, title, message, notification_type,
        icon="📋", link="/dashboard/deadlines"
    )


async def send_medication_reminder(
    db: AsyncSession,
    user_id: str,
    medication_name: str,
    time_of_day: str,
) -> bool:
    """Send medication reminder notification."""
    title = f"💊 {medication_name}"
    message = f"È ora di assumere {medication_name} ({time_of_day})"

    return await send_notification(
        db, user_id, title, message, "medication",
        icon="💊", link="/dashboard/health/medications"
    )


async def send_routine_reminder(
    db: AsyncSession,
    user_id: str,
    routine_name: str,
    time_of_day: str,
) -> bool:
    """Send routine reminder notification."""
    title = f"🕐 {routine_name}"
    message = f"È ora della routine: {routine_name}"

    return await send_notification(
        db, user_id, title, message, "routine",
        icon="🕐", link="/dashboard/routines"
    )


async def send_morning_report(
    db: AsyncSession,
    user_id: str,
    quality_label: str,
    total_hours: float,
    tip: str,
) -> bool:
    """Send morning sleep report notification."""
    title = f"☀️ Buongiorno! Sonno: {quality_label}"
    message = f"Hai dormito {total_hours}h. {tip[:100]}"

    return await send_notification(
        db, user_id, title, message, "sleep",
        icon="🌅", link="/dashboard/health/sleep"
    )
