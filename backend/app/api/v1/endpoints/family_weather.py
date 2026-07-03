"""Family weather endpoint — meteo reale (Open-Meteo, no API key) per le città
della famiglia. Legge le location dal settings store (chiave 'family' o
'weather'); se non configurate ritorna lista vuota (il frontend mostra lo stato
"non configurato", mai membri o città inventati).

NB onestà: la posizione live dei familiari (Find My) NON ha API pubbliche, quindi
qui mostriamo SOLO la città configurata per ogni membro + il meteo reale di quella
città. Nessuna posizione GPS inventata.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.sections import get_view_user_id
from app.schemas.family_weather import FamilyWeatherItem

router = APIRouter(prefix="/family-weather", tags=["family-weather"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _resolve_members(family_cfg: Optional[dict], weather_cfg: Optional[dict]) -> List[Dict[str, Any]]:
    """Estrae la lista di location da configurare.

    Contratto settings store:
      family  -> { members: [{name, city, lat, lon}], ... }
      weather -> { locations: [{label, lat, lon}], ... }

    Ritorna sempre una lista normalizzata { label, city, lat, lon }.
    Se nulla è configurato (o incompleto) ritorna lista vuota — nessun default.
    """
    members: List[Dict[str, Any]] = []

    if family_cfg and isinstance(family_cfg.get("members"), list):
        for m in family_cfg["members"]:
            if not isinstance(m, dict):
                continue
            lat, lon = m.get("lat"), m.get("lon")
            if lat is None or lon is None:
                continue
            label = m.get("name") or m.get("label") or ""
            city = m.get("city") or label
            members.append({"label": label, "city": city, "lat": lat, "lon": lon})

    if not members and weather_cfg and isinstance(weather_cfg.get("locations"), list):
        for loc in weather_cfg["locations"]:
            if not isinstance(loc, dict):
                continue
            lat, lon = loc.get("lat"), loc.get("lon")
            if lat is None or lon is None:
                continue
            label = loc.get("label") or ""
            members.append({"label": label, "city": label, "lat": lat, "lon": lon})

    return members


async def _get_setting(db: AsyncSession, user_id: Optional[str], key: str) -> Optional[dict]:
    """Legge una chiave dal settings store, in modo difensivo.

    Il modulo settings_store è fornito dalla slice Impostazioni; se non è ancora
    presente a runtime, o la lettura fallisce, torniamo None così da ripiegare
    sui default famiglia senza far crashare l'endpoint.
    """
    if not user_id:
        return None
    try:
        from app.services.settings_store import get_setting  # type: ignore
    except Exception:
        return None
    try:
        return await get_setting(db, user_id, key)
    except Exception:
        return None


async def _fetch_weather(client: httpx.AsyncClient, member: Dict[str, Any]) -> FamilyWeatherItem:
    """Chiama Open-Meteo per una singola location. Su errore ritorna l'item con
    valori meteo a None (frontend mostra '—'), mai dati inventati."""
    params = {
        "latitude": member["lat"],
        "longitude": member["lon"],
        "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_min,temperature_2m_max",
        "timezone": "auto",
        "forecast_days": 1,
    }
    base = FamilyWeatherItem(
        label=member.get("label", ""),
        city=member.get("city", ""),
        temp=None,
        code=None,
        min=None,
        max=None,
    )
    try:
        resp = await client.get(OPEN_METEO_URL, params=params, timeout=8.0)
        resp.raise_for_status()
        data = resp.json()
        current = data.get("current") or {}
        daily = data.get("daily") or {}
        temp = current.get("temperature_2m")
        code = current.get("weather_code")
        mins = daily.get("temperature_2m_min") or []
        maxs = daily.get("temperature_2m_max") or []
        return FamilyWeatherItem(
            label=base.label,
            city=base.city,
            temp=round(temp) if temp is not None else None,
            code=int(code) if code is not None else None,
            min=round(mins[0]) if mins else None,
            max=round(maxs[0]) if maxs else None,
        )
    except Exception:
        return base


@router.get("", response_model=List[FamilyWeatherItem])
@router.get("/", response_model=List[FamilyWeatherItem])
async def get_family_weather(
    db: AsyncSession = Depends(get_db),
    view_user_id: str = Depends(get_view_user_id),
) -> List[FamilyWeatherItem]:
    """Meteo reale (Open-Meteo) per le città dei familiari.

    Ritorna un array { label, city, temp, code, min, max } — una entry per
    membro/location configurata nel settings store; vuoto se non configurato.
    """
    user_id = view_user_id
    family_cfg = await _get_setting(db, user_id, "family")
    weather_cfg = await _get_setting(db, user_id, "weather")
    members = _resolve_members(family_cfg, weather_cfg)

    async with httpx.AsyncClient() as client:
        results: List[FamilyWeatherItem] = []
        for m in members:
            results.append(await _fetch_weather(client, m))
    return results
