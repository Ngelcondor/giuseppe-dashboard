"""Dashboard endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.user import User
from app.models.deadline import Deadline

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/widgets")
async def get_dashboard_widgets(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's dashboard widget configuration."""
    user_id = current_user["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {
        "layout": user.settings.get("dashboard_layout", "default"),
        "widgets": user.settings.get("widgets", []),
        "theme": user.settings.get("theme", "light"),
        "low_stimulation_mode": user.settings.get("low_stimulation_mode", False),
    }


@router.put("/layout")
async def update_dashboard_layout(
    layout_config: dict,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Update dashboard layout."""
    user_id = current_user["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Update settings
    user.settings["dashboard_layout"] = layout_config.get("layout", user.settings.get("dashboard_layout"))
    user.settings["widgets"] = layout_config.get("widgets", user.settings.get("widgets"))

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"success": True, "settings": user.settings}


@router.get("/next-task")
async def get_next_task(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the single most important task."""
    user_id = current_user["sub"]
    today = date.today()

    # Get overdue or urgent deadlines first
    result = await db.execute(
        select(Deadline)
        .where(
            (Deadline.user_id == user_id)
            & (Deadline.is_completed == False)
            & (Deadline.due_date <= today)
        )
        .order_by(Deadline.priority)
    )
    urgent = result.scalars().first()

    if urgent:
        return {
            "type": "deadline",
            "title": urgent.title,
            "due_date": urgent.due_date,
            "priority": urgent.priority.value,
            "description": urgent.description,
        }

    # Get upcoming urgent deadline
    result = await db.execute(
        select(Deadline)
        .where(
            (Deadline.user_id == user_id)
            & (Deadline.is_completed == False)
            & (Deadline.priority == "urgent")
        )
        .order_by(Deadline.due_date)
    )
    next_urgent = result.scalars().first()

    if next_urgent:
        return {
            "type": "deadline",
            "title": next_urgent.title,
            "due_date": next_urgent.due_date,
            "priority": next_urgent.priority.value,
            "description": next_urgent.description,
        }

    # Get next high priority deadline
    result = await db.execute(
        select(Deadline)
        .where(
            (Deadline.user_id == user_id)
            & (Deadline.is_completed == False)
            & (Deadline.priority == "high")
        )
        .order_by(Deadline.due_date)
    )
    next_high = result.scalars().first()

    if next_high:
        return {
            "type": "deadline",
            "title": next_high.title,
            "due_date": next_high.due_date,
            "priority": next_high.priority.value,
            "description": next_high.description,
        }

    return {"type": "none", "message": "No pending tasks"}
