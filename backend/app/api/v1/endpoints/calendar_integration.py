"""Google Calendar integration — honest status + events consumer.

Reads the shared `google_calendar` integration config from the settings store
(written by the Impostazioni slice). Until a Google OAuth token is wired in,
these endpoints return an explicit `connected: false` / `not_connected` state.
No fabricated events are ever returned.

Route prefix `/calendar/sync` is deliberately distinct from:
  - `/calendar/events`        (local DB events, calendar.py)
  - `/calendar/connections`   (CalDAV connections, calendar_sync.py)
so this module can be added without colliding with existing routers.

OAuth slot-in: when the settings value carries a valid `access_token` /
`refresh_token` (or `connected: true`), `_load_google_credentials()` is the
single place a future Google OAuth client would hydrate credentials and the
events endpoint would call the Google Calendar API. Today that path is not
implemented and we surface the not-connected state honestly.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.settings_store import get_setting

router = APIRouter(prefix="/calendar/sync", tags=["calendar-integration"])

SETTING_KEY = "google_calendar"


def _is_connected(cfg: Optional[Dict[str, Any]]) -> bool:
    """A Google Calendar config counts as connected only once OAuth is wired.

    We accept either an explicit `connected: true` flag (set by a completed
    OAuth flow) or the presence of an access/refresh token. Absent those, the
    integration is not connected — regardless of any other placeholder fields.
    """
    if not cfg:
        return False
    if cfg.get("connected") is True:
        return True
    return bool(cfg.get("access_token") or cfg.get("refresh_token"))


def _load_google_credentials(cfg: Dict[str, Any]):
    """Future OAuth slot-in point.

    When the Google OAuth flow is implemented, this returns a credentials
    object hydrated from `cfg` (tokens persisted by the settings/OAuth slice),
    which `events()` would then use to call the Google Calendar API.

    Not implemented yet — raises so the caller falls back to not-connected.
    """
    raise NotImplementedError(
        "Google Calendar OAuth flow is not implemented yet."
    )


@router.get("/status")
async def calendar_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Report whether Google Calendar is connected for the current user."""
    cfg = await get_setting(db, current_user["sub"], SETTING_KEY)
    connected = _is_connected(cfg)
    return {
        "provider": "google_calendar",
        "connected": connected,
        "status": "connected" if connected else "not_connected",
        "detail": (
            None
            if connected
            else "Google Calendar non connesso · collega l'account in Impostazioni"
        ),
    }


@router.get("/events")
async def calendar_events(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Return Google Calendar events, or an honest not-connected payload.

    Structured so a future OAuth token slots straight in: once
    `_load_google_credentials()` is implemented, the connected branch fetches
    real events. Until then we never invent events — we return an empty list
    with `connected: false`.
    """
    cfg = await get_setting(db, current_user["sub"], SETTING_KEY)

    if not _is_connected(cfg):
        return {
            "connected": False,
            "status": "not_connected",
            "events": [],
            "detail": "Google Calendar non connesso · collega l'account in Impostazioni",
        }

    # Connected per config, but the OAuth client that turns credentials into a
    # live Google Calendar API call is not implemented yet. Be honest rather
    # than fabricate events.
    try:
        _load_google_credentials(cfg or {})
    except NotImplementedError:
        return {
            "connected": True,
            "status": "pending_oauth",
            "events": [],
            "detail": (
                "Account collegato ma sync OAuth non ancora attiva · "
                "il fetch eventi da Google Calendar non è implementato"
            ),
        }

    # Unreachable until OAuth is wired; placeholder kept explicit, not faked.
    events: List[Dict[str, Any]] = []
    return {"connected": True, "status": "connected", "events": events, "detail": None}
