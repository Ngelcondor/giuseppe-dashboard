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

# Create main router
router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
# NOTE: accounts.me_router MUST precede auth.router so its GET /auth/me
# (returning {email, role, full_name}) wins FastAPI's first-match precedence
# over auth.py's legacy /auth/me handler.
router.include_router(accounts.me_router)
router.include_router(auth.router)
router.include_router(health.router)
router.include_router(sleep.router)
router.include_router(sleep_cycle.router)
router.include_router(workouts.router)
router.include_router(apple_health.router)
router.include_router(notifications.router)
router.include_router(calendar.router)
router.include_router(calendar_sync.router)
router.include_router(deadlines.router)
router.include_router(routines.router)
router.include_router(focus.router)
router.include_router(budget.router)
router.include_router(ctf.router)
router.include_router(meals.router)
router.include_router(feed.router)
router.include_router(dashboard.router)
router.include_router(scadenze.router)
router.include_router(habits_api.router)
router.include_router(mood_api.router)
router.include_router(api_tokens.router)
router.include_router(study.router)
router.include_router(university.router)
router.include_router(settings_endpoint.router)
router.include_router(accounts.router)
router.include_router(smarthome.router)
router.include_router(family_weather.router)
router.include_router(calendar_integration.router)
