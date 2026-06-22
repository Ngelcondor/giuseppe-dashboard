"""Smart Home endpoints — Philips Hue lights + Shelly consumption.

Credentials live in the shared settings store (keys 'hue' and 'shelly'),
written by the Impostazioni slice. When a config is missing/empty the
endpoints return an honest not-connected payload; real device calls go to the
user's own Hue bridge (local API) and Shelly Cloud account. NO fabricated
brightness, kWh or costs — ever.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.services.settings_store import get_setting
from app.services import smarthome_service as sh
from app.schemas.smarthome import (
    SmartHomeStatus,
    HueLight, HueLightsResponse, HueLightUpdate,
    ShellyDevice, ShellyDevicesResponse,
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


# ── Shelly devices (live power + cumulative energy) ──
@router.get("/shelly/devices", response_model=ShellyDevicesResponse)
async def shelly_devices(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShellyDevicesResponse:
    """Live per-device power + cumulative energy from the Shelly Cloud account.

    Auto-discovers every device on the account (no device_ids needed). The
    cloud has no historical per-period endpoint — that needs snapshotting,
    a separate build. Returns connected:false when Shelly is unconfigured.
    """
    cfg = await get_setting(db, current_user["sub"], SHELLY_KEY)
    if not _shelly_ready(cfg):
        return ShellyDevicesResponse(connected=False)

    try:
        devices = await sh.shelly_devices(cfg["auth_key"], cfg["server"])
    except Exception as exc:  # noqa: BLE001 — honest error surface
        return ShellyDevicesResponse(
            connected=True,
            error=f"Shelly Cloud non raggiungibile: {exc}",
        )

    points = [ShellyDevice(**d) for d in devices]
    return ShellyDevicesResponse(
        connected=True,
        devices=points,
        total_power_w=round(sum(p.power_w for p in points), 1),
        total_kwh=round(sum(p.total_kwh for p in points), 3),
    )
