"""Sezioni concedibili agli account guest (le "spunte" in Impostazioni).

Ogni router dati è mappato a una sezione in api/v1/router.py; un guest accede
solo alle sezioni presenti in User.allowed_sections. NULL = tutte (guest
storici). Gli admin ignorano il vincolo. I router con auth webhook propria
(apple_health, sleep_cycle) non passano di qui.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

# Chiavi valide — tenere allineate con SECTION_LABELS nel frontend
# (impostazioni) e con la mappatura router→sezione in api/v1/router.py.
SECTION_KEYS = [
    "universita",
    "studio",
    "calendario",
    "finanze",
    "salute",
    "sonno",
    "smart_home",
    "feed",
    "famiglia",
]


async def get_view_user_id(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    """ID dell'utente di cui LEGGERE i dati.

    L'app è single-tenant: i dati appartengono all'admin. Un ospite (che ha già
    passato require_section sul router) deve leggere i dati dell'admin, non i
    propri — che non esistono. Da usare SOLO nelle letture: le scritture restano
    su current_user["sub"] e per i guest sono comunque bloccate da require_editor.
    Esclusi per design: settings (credenziali), notifiche, api-token — restano
    per-utente.
    """
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalars().first()
    if not user or (user.role or "admin") != "guest":
        return current_user["sub"]
    admin = await db.execute(
        select(User)
        .where(User.role == "admin", User.is_active.is_(True))
        .order_by(User.created_at)
        .limit(1)
    )
    owner = admin.scalars().first()
    return str(owner.id) if owner else current_user["sub"]


def require_section(section: str):
    """Dependency factory: consente admin sempre, guest solo se la sezione
    è tra le sue allowed_sections (o se il campo è NULL = tutte)."""
    assert section in SECTION_KEYS, f"sezione sconosciuta: {section}"

    async def _dep(
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        result = await db.execute(select(User).where(User.id == current_user["sub"]))
        user = result.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Utente non valido",
            )
        if (user.role or "admin") == "admin":
            return current_user
        allowed = user.allowed_sections
        if allowed is None or section in allowed:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sezione non abilitata per questo account",
        )

    return _dep
