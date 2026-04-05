"""Notification endpoints: push subscriptions + notification center."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update
from datetime import datetime
from typing import List
from pydantic import BaseModel
import uuid as uuid_mod

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.notification import PushSubscription, Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: str | None = None


class PushSubscriptionResponse(BaseModel):
    id: uuid_mod.UUID
    endpoint: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: uuid_mod.UUID
    title: str
    message: str
    notification_type: str
    icon: str | None
    link: str | None
    is_read: bool
    is_pushed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: str = "info"
    icon: str | None = None
    link: str | None = None


class UnreadCountResponse(BaseModel):
    count: int


# ─── VAPID public key endpoint ───────────────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key() -> dict:
    """Get the VAPID public key for push subscription."""
    import os
    vapid_key = os.getenv("VAPID_PUBLIC_KEY", "")
    return {"public_key": vapid_key}


# ─── Push subscription endpoints ─────────────────────────────────────────────

@router.post("/push/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    sub: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSubscriptionResponse:
    """Register a push notification subscription."""
    # Check for existing subscription with same endpoint
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == sub.endpoint)
    )
    existing = result.scalars().first()
    if existing:
        existing.is_active = True
        existing.p256dh_key = sub.p256dh_key
        existing.auth_key = sub.auth_key
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        return PushSubscriptionResponse.from_orm(existing)

    push_sub = PushSubscription(
        user_id=current_user["sub"],
        endpoint=sub.endpoint,
        p256dh_key=sub.p256dh_key,
        auth_key=sub.auth_key,
        user_agent=sub.user_agent,
    )
    db.add(push_sub)
    await db.commit()
    await db.refresh(push_sub)
    return PushSubscriptionResponse.from_orm(push_sub)


@router.delete("/push/unsubscribe")
async def unsubscribe_push(
    endpoint: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Unsubscribe from push notifications."""
    result = await db.execute(
        select(PushSubscription).where(
            (PushSubscription.endpoint == endpoint)
            & (PushSubscription.user_id == current_user["sub"])
        )
    )
    sub = result.scalars().first()
    if sub:
        sub.is_active = False
        db.add(sub)
        await db.commit()
    return {"status": "ok"}


# ─── Notification center endpoints ───────────────────────────────────────────

@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[NotificationResponse]:
    """List notifications for the current user."""
    query = select(Notification).where(
        Notification.user_id == current_user["sub"]
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    return [NotificationResponse.from_orm(n) for n in notifications]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    """Get count of unread notifications."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            (Notification.user_id == current_user["sub"])
            & (Notification.is_read == False)
        )
    )
    count = result.scalar() or 0
    return UnreadCountResponse(count=count)


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(
            (Notification.id == notification_id)
            & (Notification.user_id == current_user["sub"])
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    db.add(notification)
    await db.commit()
    return {"status": "ok"}


@router.put("/read-all")
async def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications as read."""
    await db.execute(
        update(Notification)
        .where(
            (Notification.user_id == current_user["sub"])
            & (Notification.is_read == False)
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(
            (Notification.id == notification_id)
            & (Notification.user_id == current_user["sub"])
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    await db.delete(notification)
    await db.commit()
