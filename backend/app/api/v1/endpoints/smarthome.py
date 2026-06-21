"""Smart Home endpoints — Philips Hue lights + Shelly consumption.

Credentials live in the shared settings store (keys 'hue' and 'shelly'),
written by the Impostazioni slice. When a config is missing/empty the
endpoints return an honest not-connected payload; real device calls go to the
user's own Hue bridge (local API) and Shelly Cloud account. NO fabricated
brightness, kWh or costs — ever.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.services.settings_store import get_setting
from app.services import smarthome_service as sh
from app.schemas.smarthome import (
    SmartHomeStatus,
    HueLight, HueLightsResponse, HueLightUpdate,
    ShellyDevicePoint, ShellyConsumptionResponse,
)

router = APIRouter(prefix="/smarthome", tags=["smarthome"])

HUE_KEY = "hue"
SHELLY_KEY = "shelly"


def _hue_ready(cfg: Optional[Dict[str, Any]]) -> bool:
    return bool(cfg and cfg.get("bridge_ip") and cfg.get("app_key"))


def _shelly_ready(cfg: Optional[Dict[str, Any]]) -> bool:
    return bool(cfg and cfg.get("auth_key") and cfg.get("server"))


# ── Status ──
@router.get("/status", response_model=SmartHomeStatus)
async def status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SmartHomeStatus:
    """Report which Smart Home integrations are configured."""
    hue_cfg = await get_setting(db, current_user["sub"], HUE_KEY)
    shelly_cfg = await get_setting(db, current_user["sub"], SHELLY_KEY)
    return SmartHomeStatus(
        hue_connected=_hue_ready(hue_cfg),
        shelly_connected=_shelly_ready(shelly_cfg),
    )


# ── Hue lights ──
@router.get("/hue/lights", response_model=HueLightsResponse)
async def hue_lights(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HueLightsResponse:
    """List Hue lights from the local bridge, or connected:false if unset."""
    cfg = await get_setting(db, current_user["sub"], HUE_KEY)
    if not _hue_ready(cfg):
        return HueLightsResponse(connected=False)

    try:
        raw = await sh.hue_get_lights(cfg["bridge_ip"], cfg["app_key"])
    except Exception as exc:  # noqa: BLE001 — honest error surface
        return HueLightsResponse(
            connected=True,
            error=f"Bridge non raggiungibile: {exc}",
        )

    return HueLightsResponse(
        connected=True,
        lights=[HueLight(**l) for l in raw],
    )


@router.put("/hue/lights/{light_id}", response_model=HueLight, dependencies=[Depends(require_editor)])
async def update_hue_light(
    light_id: str,
    body: HueLightUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HueLight:
    """Control a single Hue light (on/off and/or brightness)."""
    cfg = await get_setting(db, current_user["sub"], HUE_KEY)
    if not _hue_ready(cfg):
        raise HTTPException(status_code=409, detail="Philips Hue non configurato")

    bridge_ip, app_key = cfg["bridge_ip"], cfg["app_key"]
    try:
        await sh.hue_set_light(bridge_ip, app_key, light_id, body.on, body.bri)
        lights = await sh.hue_get_lights(bridge_ip, app_key)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Errore bridge Hue: {exc}")

    updated = next((l for l in lights if l["id"] == str(light_id)), None)
    if updated is None:
        raise HTTPException(status_code=404, detail="Luce non trovata")
    return HueLight(**updated)


# ── Shelly consumption ──
@router.get("/shelly/consumption", response_model=ShellyConsumptionResponse)
async def shelly_consumption(
    period: str = Query("day", pattern="^(day|week|month)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShellyConsumptionResponse:
    """Real per-device energy consumption for the period, or connected:false."""
    cfg = await get_setting(db, current_user["sub"], SHELLY_KEY)
    if not _shelly_ready(cfg):
        return ShellyConsumptionResponse(connected=False, period=period)

    device_ids = cfg.get("device_ids") or []
    if not device_ids:
        return ShellyConsumptionResponse(
            connected=True,
            period=period,
            error="Nessun device_id configurato in Impostazioni",
        )

    try:
        devices = await sh.shelly_consumption(
            cfg["auth_key"], cfg["server"], device_ids, period,
        )
    except Exception as exc:  # noqa: BLE001 — honest error surface
        return ShellyConsumptionResponse(
            connected=True,
            period=period,
            error=f"Shelly Cloud non raggiungibile: {exc}",
        )

    points = [ShellyDevicePoint(**d) for d in devices]
    total = round(sum(p.consumption_kwh for p in points), 3)
    return ShellyConsumptionResponse(
        connected=True,
        period=period,
        total_kwh=total,
        devices=points,
    )
