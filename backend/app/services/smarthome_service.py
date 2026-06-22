"""Smart Home integration service — Philips Hue (local API) + Shelly Cloud.

All calls hit the user's own hardware/account using credentials stored in the
shared settings store (keys 'hue' and 'shelly'). Nothing here is fabricated:
when a call fails or a config is missing the caller surfaces an honest
not-connected / error state.
"""
from typing import Any, Dict, List, Optional
import httpx

HUE_TIMEOUT = 5.0
SHELLY_TIMEOUT = 10.0


# ── Philips Hue (local bridge API) ──
async def hue_get_lights(bridge_ip: str, app_key: str) -> List[Dict[str, Any]]:
    """Fetch lights from the local Hue bridge.

    GET https://{bridge_ip}/api/{app_key}/lights
    Returns a normalised list [{id, name, on, bri, reachable}].
    Raises httpx.HTTPError / ValueError on failure (handled by caller).

    Modern Hue bridges run nginx and force HTTPS (HTTP 301-redirects to it)
    with a self-signed cert (CN = bridgeid) -> verify=False, follow redirects.
    """
    url = f"https://{bridge_ip}/api/{app_key}/lights"
    async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
        resp = await client.get(url, timeout=HUE_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

    # The bridge returns an error envelope as a list when the app_key is wrong.
    if isinstance(data, list):
        msg = "Bridge error"
        if data and isinstance(data[0], dict) and "error" in data[0]:
            msg = data[0]["error"].get("description", msg)
        raise ValueError(msg)

    lights: List[Dict[str, Any]] = []
    for light_id, light in data.items():
        state = light.get("state", {})
        lights.append({
            "id": str(light_id),
            "name": light.get("name", f"Luce {light_id}"),
            "on": bool(state.get("on", False)),
            "bri": int(state.get("bri", 254)),
            "reachable": bool(state.get("reachable", True)),
        })
    lights.sort(key=lambda l: l["name"].lower())
    return lights


async def hue_set_light(
    bridge_ip: str, app_key: str, light_id: str,
    on: Optional[bool], bri: Optional[int],
) -> None:
    """Control a light: PUT https://{bridge_ip}/api/{app_key}/lights/{id}/state.

    Raises on transport/bridge error (handled by caller).
    """
    body: Dict[str, Any] = {}
    if on is not None:
        body["on"] = on
    # Hue ignores bri when the lamp is off; only send it when turning/keeping on.
    if bri is not None and on is not False:
        body["bri"] = max(1, min(254, int(bri)))
    if not body:
        return

    url = f"https://{bridge_ip}/api/{app_key}/lights/{light_id}/state"
    async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
        resp = await client.put(url, json=body, timeout=HUE_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and "error" in entry:
                raise ValueError(entry["error"].get("description", "Bridge error"))


# ── Shelly Cloud API ──
async def shelly_devices(auth_key: str, server: str) -> List[Dict[str, Any]]:
    """Fetch all Shelly devices' live status from the Cloud account.

    POST {server}/device/all_status (auth_key) -> per-device status. The cloud
    control API exposes live state, not historical per-period stats (the old
    /statistics/.../consumption path returns 404). For each device we sum its
    metered channels: live active power (W) and the cumulative energy counter
    (Wh -> kWh). Supports Gen2/3 (switch:N with apower + aenergy.total) and
    Gen1 (meters[] power + total in Watt-minutes).

    Returns [{device_id, name, power_w, total_kwh, output, online}].
    Raises on transport/API failure (handled by caller). Nothing fabricated.
    """
    base = server.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base}/device/all_status",
            data={"auth_key": auth_key},
            timeout=SHELLY_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()

    if not payload.get("isok", False):
        raise ValueError(str(payload.get("errors") or "Shelly Cloud error"))

    devices_status = (payload.get("data") or {}).get("devices_status") or {}
    out: List[Dict[str, Any]] = []
    for dev_id, st in devices_status.items():
        if not isinstance(st, dict):
            continue
        power_w = 0.0
        total_wh = 0.0
        output = False
        # Gen2/3 RPC: switch:0, switch:1, ... (apower in W, aenergy.total in Wh)
        for key, val in st.items():
            if key.startswith("switch:") and isinstance(val, dict):
                power_w += float(val.get("apower") or 0)
                total_wh += float((val.get("aenergy") or {}).get("total") or 0)
                if val.get("output"):
                    output = True
        # Gen1 fallback: meters[] (power W, total in Watt-minutes) + relays[]
        if not any(k.startswith("switch:") for k in st):
            for m in (st.get("meters") or []):
                if isinstance(m, dict):
                    power_w += float(m.get("power") or 0)
                    total_wh += float(m.get("total") or 0) / 60.0  # W*min -> Wh
            if any(isinstance(r, dict) and r.get("ison") for r in (st.get("relays") or [])):
                output = True

        online = bool((st.get("cloud") or {}).get("connected", st.get("_online", True)))
        out.append({
            "device_id": str(dev_id),
            "name": st.get("name") or f"Shelly {str(dev_id)[-4:]}",
            "power_w": round(power_w, 1),
            "total_kwh": round(total_wh / 1000.0, 3),
            "output": output,
            "online": online,
        })
    out.sort(key=lambda d: d["name"].lower())
    return out


def consumption_kwh(readings, period_start) -> float:
    """Energy consumed in [period_start, now] from cumulative snapshots.

    `readings` is one device's snapshots (objects with .recorded_at and
    .total_kwh) sorted ascending, including at least one anchor BEFORE
    period_start when available. Consumption = sum of positive deltas between
    consecutive snapshots; a negative delta (the device's counter was reset)
    contributes 0 rather than a bogus huge/negative number. Returns 0.0 when
    there aren't yet two usable snapshots (history still accumulating).
    """
    anchor = None
    in_window = []
    for r in readings:
        if r.recorded_at < period_start:
            anchor = r  # keep the latest snapshot before the window
        else:
            in_window.append(r)
    series = ([anchor] if anchor is not None else []) + in_window
    if len(series) < 2:
        return 0.0
    total = 0.0
    for a, b in zip(series, series[1:]):
        delta = float(b.total_kwh) - float(a.total_kwh)
        if delta > 0:
            total += delta
    return round(total, 3)
