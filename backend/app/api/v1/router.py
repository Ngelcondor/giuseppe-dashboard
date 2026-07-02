"""API v1 router that combines all endpoints."""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    health,
    sleep,
    sleep_cycle,
    workouts,
    apple_health,
    notifications,
    calendar,
    calendar_sync,
    deadlines,
    routines,
    focus,
    budget,
    ctf,
    meals,
    feed,
    dashboard,
    scadenze,
    habits_api,
    mood_api,
    api_tokens,
    study,
    university,
    accounts,
    smarthome,
    family_weather,
    calendar_integration,
)
from app.api.v1.endpoints import settings as settings_endpoint
from fastapi import Depends
from app.core.sections import require_section

# Create main router
router = APIRouter(prefix="/api/v1")


def _sec(section: str) -> list:
    """Dependency list che vincola un intero router a una sezione guest."""
    return [Depends(require_section(section))]


# Include all endpoint routers
# NOTE: accounts.me_router MUST precede auth.router so its GET /auth/me
# (returning {email, role, full_name}) wins FastAPI's first-match precedence
# over auth.py's legacy /auth/me handler.
#
# Router senza sezione: auth/account (self-management), notifications,
# api_tokens, settings, dashboard (config personale) — e i router con auth
# webhook propria (apple_health, sleep_cycle), che NON devono ricevere la
# dependency JWT.
router.include_router(accounts.me_router)
router.include_router(auth.router)
router.include_router(health.router, dependencies=_sec("salute"))
router.include_router(sleep.router, dependencies=_sec("sonno"))
router.include_router(sleep_cycle.router)
router.include_router(workouts.router, dependencies=_sec("salute"))
router.include_router(apple_health.router)
router.include_router(notifications.router)
router.include_router(calendar.router, dependencies=_sec("calendario"))
router.include_router(calendar_sync.router, dependencies=_sec("calendario"))
router.include_router(deadlines.router, dependencies=_sec("finanze"))
router.include_router(routines.router, dependencies=_sec("salute"))
router.include_router(focus.router, dependencies=_sec("salute"))
router.include_router(budget.router, dependencies=_sec("finanze"))
router.include_router(ctf.router, dependencies=_sec("studio"))
router.include_router(meals.router, dependencies=_sec("salute"))
router.include_router(feed.router, dependencies=_sec("feed"))
router.include_router(dashboard.router)
router.include_router(scadenze.router, dependencies=_sec("finanze"))
router.include_router(habits_api.router, dependencies=_sec("salute"))
router.include_router(mood_api.router, dependencies=_sec("salute"))
router.include_router(api_tokens.router)
router.include_router(study.router, dependencies=_sec("studio"))
router.include_router(university.router, dependencies=_sec("universita"))
router.include_router(settings_endpoint.router)
router.include_router(accounts.router)
router.include_router(smarthome.router, dependencies=_sec("smart_home"))
router.include_router(family_weather.router, dependencies=_sec("famiglia"))
router.include_router(calendar_integration.router, dependencies=_sec("calendario"))
