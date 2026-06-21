"""Hack The Box API client.

Reads the user's HTB App Token (stored via the shared settings store under the
``htb`` key) and fetches the authenticated profile/stats from the HTB Labs API.

Design rules (honest data only):
* No token configured        -> caller renders the "Collega HTB" CTA.
* Token present but call fails -> return ``connected=False`` with a ``detail``.
* Token valid                -> return the real fields HTB returns; any field
  HTB omits stays ``None`` (never fabricated).

HTB personal App Tokens are JWTs created in the HTB account settings and sent as
``Authorization: Bearer <token>`` against the Labs API (v4).
"""
from typing import Any, Dict, Optional

import httpx

HTB_API_BASE = "https://labs.hackthebox.com/api/v4"
_TIMEOUT = 8.0
_HEADERS_EXTRA = {
    # HTB rejects requests without a browser-like UA on some edges.
    "User-Agent": "giuseppe-dashboard/1.0",
    "Accept": "application/json",
}


def _safe_int(value: Any) -> Optional[int]:
    """Coerce to int when possible, else None (HTB sometimes sends strings)."""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


async def fetch_htb_profile(api_token: str) -> Dict[str, Any]:
    """Fetch the authenticated HTB user's profile + stats.

    Returns a dict matching the ``HTBProfile`` schema shape. On any error returns
    ``{"connected": False, "detail": "..."}`` — never raises to the caller.
    """
    token = (api_token or "").strip()
    if not token:
        return {"connected": False, "detail": "Token HTB mancante."}

    headers = {"Authorization": f"Bearer {token}", **_HEADERS_EXTRA}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers) as client:
            # 1) Identity — who the token belongs to.
            info_resp = await client.get(f"{HTB_API_BASE}/user/info")
            if info_resp.status_code in (401, 403):
                return {"connected": False, "detail": "Token HTB non valido o scaduto."}
            info_resp.raise_for_status()
            info = (info_resp.json() or {}).get("info") or {}

            user_id = info.get("id")
            if not user_id:
                return {"connected": False, "detail": "Risposta HTB inattesa."}

            # 2) Full profile — rank, points, owns, ranking.
            prof = {}
            try:
                prof_resp = await client.get(f"{HTB_API_BASE}/profile/{user_id}")
                prof_resp.raise_for_status()
                prof = (prof_resp.json() or {}).get("profile") or {}
            except httpx.HTTPError:
                # Identity worked but stats endpoint failed — still connected,
                # just surface identity with whatever /user/info gave us.
                prof = {}

            return {
                "connected": True,
                "name": prof.get("name") or info.get("name"),
                "rank": prof.get("rank") or info.get("rank"),
                "points": _safe_int(prof.get("points")),
                "user_owns": _safe_int(prof.get("user_owns")),
                "system_owns": _safe_int(prof.get("system_owns")),
                "ranking": _safe_int(prof.get("ranking")),
                "user_bloods": _safe_int(prof.get("user_bloods")),
                "system_bloods": _safe_int(prof.get("system_bloods")),
                "avatar": prof.get("avatar") or info.get("avatar"),
                "country": prof.get("country_name") or info.get("country_name"),
                "detail": None,
            }
    except httpx.HTTPStatusError as exc:
        return {"connected": False, "detail": f"HTB API errore {exc.response.status_code}."}
    except httpx.HTTPError:
        return {"connected": False, "detail": "Impossibile raggiungere l'API di HTB."}
    except Exception:  # pragma: no cover - defensive, never break the page
        return {"connected": False, "detail": "Errore inatteso nel recupero del profilo HTB."}
