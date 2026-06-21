"""Smart Home integration service — Philips Hue (local API) + Shelly Cloud.

All calls hit the user's own hardware/account using credentials stored in the
shared settings store (keys 'hue' and 'shelly'). Nothing here is fabricated:
when a call fails or a config is missing the caller surfaces an honest
not-connected / error state.
"""
from typing import Any, Dict, List, Optional, Tuple
from datetime import date, timedelta
import httpx

HUE_TIMEOUT = 5.0
SHELLY_TIMEOUT = 10.0


# ── Philips Hue (local bridge API) ──
async def hue_get_lights(bridge_ip: str, app_key: str) -> List[Dict[str, Any]]:
    """Fetch lights from the local Hue bridge.

    GET http://{bridge_ip}/api/{app_key}/lights
    Returns a normalised list [{id, name, on, bri, reachable}].
    Raises httpx.HTTPError / ValueError on failure (handled by caller).
    """
    url = f"http://{bridge_ip}/api/{app_key}/lights"
    async with httpx.AsyncClient() as client:
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
    """Control a light: PUT http://{bridge_ip}/api/{app_key}/lights/{id}/state.

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

    url = f"http://{bridge_ip}/api/{app_key}/lights/{light_id}/state"
    async with httpx.AsyncClient() as client:
        resp = await client.put(url, json=body, timeout=HUE_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and "error" in entry:
                raise ValueError(entry["error"].get("description", "Bridge error"))


# ── Shelly Cloud API ──
def shelly_period_range(period: str) -> Tuple[date, date]:
    """Map a period token to an inclusive [date_from, date_to] range."""
    today = date.today()
    if period == "day":
        return today, today
    if period == "week":
        return today - timedelta(days=6), today
    # month: rolling 30-day window ending today
    return today - timedelta(days=29), today


async def shelly_consumption(
    auth_key: str, server: str, device_ids: List[str], period: str,
) -> List[Dict[str, Any]]:
    """Query real per-device energy consumption (kWh) for the period.

    Uses the Shelly Cloud statistics endpoint:
      GET {server}/statistics/relay/consumption
          ?id={device}&channel=0&date_range=custom
          &date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&auth_key={auth_key}

    Returns [{device_id, name, consumption_kwh}]. Devices that error out are
    reported with consumption 0.0 and their id as name — never invented values.
    Raises if NO device could be reached (caller surfaces honest error).
    """
    date_from, date_to = shelly_period_range(period)
    base = server.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"

    results: List[Dict[str, Any]] = []
    any_ok = False
    last_error: Optional[Exception] = None

    async with httpx.AsyncClient() as client:
        for device_id in device_ids:
            try:
                resp = await client.get(
                    f"{base}/statistics/relay/consumption",
                    params={
                        "id": device_id,
                        "channel": 0,
                        "date_range": "custom",
                        "date_from": date_from.isoformat(),
                        "date_to": date_to.isoformat(),
                        "auth_key": auth_key,
                    },
                    timeout=SHELLY_TIMEOUT,
                )
                resp.raise_for_status()
                payload = resp.json()
            except Exception as exc:  # noqa: BLE001 — recorded, not fabricated
                last_error = exc
                results.append({"device_id": device_id, "name": device_id, "consumption_kwh": 0.0})
                continue

            if not payload.get("isok", False):
                last_error = ValueError(payload.get("errors") or "Shelly API error")
                results.append({"device_id": device_id, "name": device_id, "consumption_kwh": 0.0})
                continue

            any_ok = True
            results.append({
                "device_id": device_id,
                "name": str(payload.get("data", {}).get("device_name") or device_id),
                "consumption_kwh": round(_shelly_sum_kwh(payload.get("data", {})), 3),
            })

    if not any_ok and last_error is not None:
        raise last_error
    return results


def _shelly_sum_kwh(data: Dict[str, Any]) -> float:
    """Sum the per-interval consumption returned by the statistics endpoint.

    The endpoint returns data['history'] as a list of buckets each carrying a
    'consumption' value in Watt-hours; total kWh = sum(consumption)/1000.
    Falls back to data['total'] (Wh) when no history breakdown is present.
    """
    history = data.get("history")
    if isinstance(history, list) and history:
        total_wh = 0.0
        for bucket in history:
            if isinstance(bucket, dict):
                total_wh += float(bucket.get("consumption", 0) or 0)
        return total_wh / 1000.0
    total = data.get("total")
    if total is not None:
        return float(total) / 1000.0
    return 0.0
