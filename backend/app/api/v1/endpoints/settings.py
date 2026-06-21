"""Integration config store endpoints.

GET  /settings          -> { key: value, ... } for the current user
PUT  /settings/{key}    -> upsert one setting (editor only)

Values are opaque JSON dicts whose shape is owned by the consuming slice
(see the INTEGRATION CONFIG CONTRACT). Authenticated.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.app_settings import AppSetting
from app.schemas.app_settings import SettingUpdate
from app.services.settings_store import set_setting

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", dependencies=[Depends(get_current_user)])
async def get_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all settings for the current user as { key: value, ... }."""
    user_id = current_user.get("sub")
    rows = (
        await db.execute(select(AppSetting).where(AppSetting.user_id == user_id))
    ).scalars().all()
    return {row.key: row.value for row in rows}


@router.put("/{key}", dependencies=[Depends(require_editor)])
async def put_setting(
    key: str,
    body: SettingUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upsert one setting for the current user. Editor only."""
    user_id = current_user.get("sub")
    row = await set_setting(db, user_id, key, body.value)
    return {row.key: row.value}
