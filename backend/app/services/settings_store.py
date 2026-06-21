"""Shared integration config store.

Every integration slice reads its configuration through `get_setting` and the
Settings UI persists it through `set_setting`. Values are opaque JSON dicts whose
shape is owned by the consuming slice; see the INTEGRATION CONFIG CONTRACT.

Consumer slices that find `None`/empty must render an honest not_connected
state — never fabricate data.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.app_settings import AppSetting


async def get_setting(db: AsyncSession, user_id, key: str) -> Optional[dict]:
    """Return the stored value dict for (user_id, key), or None if absent."""
    result = await db.execute(
        select(AppSetting).where(
            AppSetting.user_id == user_id,
            AppSetting.key == key,
        )
    )
    row = result.scalars().first()
    return row.value if row else None


async def set_setting(db: AsyncSession, user_id, key: str, value: dict) -> AppSetting:
    """Upsert the value dict for (user_id, key). Commits and returns the row."""
    result = await db.execute(
        select(AppSetting).where(
            AppSetting.user_id == user_id,
            AppSetting.key == key,
        )
    )
    row = result.scalars().first()
    if row:
        row.value = value
    else:
        row = AppSetting(user_id=user_id, key=key, value=value)
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
