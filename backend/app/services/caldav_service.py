"""CalDAV service for syncing with Apple Calendar and other CalDAV providers."""
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

import caldav
from caldav.elements import dav
from icalendar import Calendar as iCalendar

from app.core.config import settings
from app.core.redis import get_cached, set_cached, invalidate_cache_pattern

logger = logging.getLogger(__name__)

# Known CalDAV endpoints
CALDAV_PROVIDERS = {
    "apple": "https://caldav.icloud.com",
    "google": "https://apidata.googleusercontent.com/caldav/v2",
    "nextcloud": None,  # User provides their own URL
}


@dataclass
class CalDAVCalendarInfo:
    """Represents a remote calendar's metadata."""
    calendar_id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None


@dataclass
class CalDAVEvent:
    """Represents a parsed CalDAV event."""
    uid: str
    summary: str
    dtstart: datetime
    dtend: Optional[datetime] = None
    description: Optional[str] = None
    location: Optional[str] = None
    all_day: bool = False
    calendar_name: Optional[str] = None
    calendar_color: Optional[str] = None
    rrule: Optional[str] = None
    last_modified: Optional[datetime] = None


class CalDAVService:
    """Service for interacting with CalDAV servers (Apple iCloud, Google, Nextcloud, etc.)."""

    def __init__(self, url: str, username: str, password: str):
        """
        Initialize CalDAV connection.

        Args:
            url: CalDAV server URL.
            username: Username (Apple ID email for iCloud).
            password: App-specific password.
        """
        self.url = url
        self.username = username
        self.password = password
        self._client: Optional[caldav.DAVClient] = None
        self._principal: Optional[caldav.Principal] = None

    def _connect(self) -> caldav.DAVClient:
        """Establish connection to CalDAV server."""
        if self._client is None:
            self._client = caldav.DAVClient(
                url=self.url,
                username=self.username,
                password=self.password,
            )
            self._principal = self._client.principal()
        return self._client

    def test_connection(self) -> Dict[str, Any]:
        """
        Test CalDAV connection and return server info.

        Returns:
            Dict with connection status and available calendars.

        Raises:
            Exception: If connection fails.
        """
        try:
            self._connect()
            calendars = self._principal.calendars()
            return {
                "success": True,
                "calendars_count": len(calendars),
                "calendars": [
                    CalDAVCalendarInfo(
                        calendar_id=str(cal.url),
                        name=cal.name or "Unnamed",
                        color=getattr(cal, "color", None),
                    )
                    for cal in calendars
                ],
            }
        except caldav.lib.error.AuthorizationError:
            return {
                "success": False,
                "error": "auth_failed",
                "message": "Autenticazione fallita. Controlla username e app-specific password.",
            }
        except Exception as e:
            logger.error(f"CalDAV connection test failed: {e}")
            return {
                "success": False,
                "error": "connection_failed",
                "message": f"Connessione fallita: {str(e)}",
            }

    def list_calendars(self) -> List[CalDAVCalendarInfo]:
        """
        List all available calendars on the server.

        Returns:
            List of CalDAVCalendarInfo objects.
        """
        self._connect()
        calendars = self._principal.calendars()
        result = []
        for cal in calendars:
            color = None
            try:
                # Try to get calendar color (Apple-specific property)
                props = cal.get_properties([dav.DisplayName()])
                color = getattr(cal, "color", None)
            except Exception:
                pass

            result.append(
                CalDAVCalendarInfo(
                    calendar_id=str(cal.url),
                    name=cal.name or "Unnamed",
                    color=color,
                    description=getattr(cal, "description", None),
                )
            )
        return result

    def fetch_events(
        self,
        start: datetime,
        end: datetime,
        calendar_ids: Optional[List[str]] = None,
    ) -> List[CalDAVEvent]:
        """
        Fetch events from CalDAV server within a date range.

        Args:
            start: Start of date range.
            end: End of date range.
            calendar_ids: Optional list of calendar URLs to filter.

        Returns:
            List of CalDAVEvent objects.
        """
        self._connect()
        calendars = self._principal.calendars()
        events: List[CalDAVEvent] = []

        for cal in calendars:
            # Filter by calendar IDs if specified
            if calendar_ids and str(cal.url) not in calendar_ids:
                continue

            cal_name = cal.name or "Unnamed"
            cal_color = getattr(cal, "color", None)

            try:
                results = cal.search(
                    start=start,
                    end=end,
                    event=True,
                    expand=True,
                )
            except Exception as e:
                logger.warning(f"Failed to fetch events from calendar '{cal_name}': {e}")
                continue

            for event in results:
                try:
                    parsed = self._parse_vevent(event, cal_name, cal_color)
                    if parsed:
                        events.append(parsed)
                except Exception as e:
                    logger.warning(f"Failed to parse event from '{cal_name}': {e}")
                    continue

        # Sort by start time
        events.sort(key=lambda e: e.dtstart)
        return events

    def _parse_vevent(
        self,
        event: caldav.Event,
        calendar_name: str,
        calendar_color: Optional[str],
    ) -> Optional[CalDAVEvent]:
        """
        Parse a CalDAV event into our CalDAVEvent dataclass.

        Args:
            event: Raw CalDAV event.
            calendar_name: Name of the source calendar.
            calendar_color: Color of the source calendar.

        Returns:
            CalDAVEvent or None if parsing fails.
        """
        try:
            ical = iCalendar.from_ical(event.data)
        except Exception:
            return None

        for component in ical.walk():
            if component.name != "VEVENT":
                continue

            uid = str(component.get("uid", ""))
            summary = str(component.get("summary", "Senza titolo"))
            description = str(component.get("description", "")) or None
            location = str(component.get("location", "")) or None

            dtstart = component.get("dtstart")
            dtend = component.get("dtend")

            if not dtstart:
                continue

            dtstart_val = dtstart.dt
            dtend_val = dtend.dt if dtend else None

            # Determine if all-day event (date vs datetime)
            all_day = not isinstance(dtstart_val, datetime)

            # Convert date to datetime for consistency
            if all_day:
                dtstart_val = datetime.combine(dtstart_val, datetime.min.time())
                if dtend_val:
                    dtend_val = datetime.combine(dtend_val, datetime.min.time())
                else:
                    dtend_val = dtstart_val + timedelta(days=1)
            elif dtend_val is None:
                dtend_val = dtstart_val + timedelta(hours=1)

            # Make timezone-naive for consistency
            if hasattr(dtstart_val, "tzinfo") and dtstart_val.tzinfo:
                dtstart_val = dtstart_val.replace(tzinfo=None)
            if hasattr(dtend_val, "tzinfo") and dtend_val.tzinfo:
                dtend_val = dtend_val.replace(tzinfo=None)

            # Get recurrence rule if present
            rrule = None
            if component.get("rrule"):
                rrule = component.get("rrule").to_ical().decode()

            # Get last modified
            last_modified = None
            if component.get("last-modified"):
                lm = component.get("last-modified").dt
                if hasattr(lm, "tzinfo") and lm.tzinfo:
                    lm = lm.replace(tzinfo=None)
                last_modified = lm

            return CalDAVEvent(
                uid=uid,
                summary=summary,
                dtstart=dtstart_val,
                dtend=dtend_val,
                description=description,
                location=location,
                all_day=all_day,
                calendar_name=calendar_name,
                calendar_color=calendar_color,
                rrule=rrule,
                last_modified=last_modified,
            )

        return None


async def sync_calendar_events(
    user_id: str,
    connection_id: str,
    caldav_url: str,
    username: str,
    password: str,
    calendar_ids: Optional[List[str]] = None,
    days_back: int = 7,
    days_forward: int = 90,
) -> Dict[str, Any]:
    """
    Sync events from CalDAV server to local database.

    This is the main entry point for calendar synchronization.

    Args:
        user_id: User's UUID.
        connection_id: CalendarConnection UUID.
        caldav_url: CalDAV server URL.
        username: CalDAV username.
        password: CalDAV password (app-specific).
        calendar_ids: Optional filter for specific calendars.
        days_back: How many days in the past to sync.
        days_forward: How many days in the future to sync.

    Returns:
        Dict with sync results.
    """
    service = CalDAVService(url=caldav_url, username=username, password=password)

    now = datetime.utcnow()
    start = now - timedelta(days=days_back)
    end = now + timedelta(days=days_forward)

    try:
        events = service.fetch_events(start=start, end=end, calendar_ids=calendar_ids)

        # Invalidate cached calendar data for this user
        await invalidate_cache_pattern(f"calendar:{user_id}:*")

        return {
            "success": True,
            "events_fetched": len(events),
            "events": events,
            "sync_range": {
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        }
    except Exception as e:
        logger.error(f"Calendar sync failed for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "events_fetched": 0,
            "events": [],
        }
