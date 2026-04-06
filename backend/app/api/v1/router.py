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
    habits,
    mood,
    budget,
    ctf,
    meals,
    weather,
    feed,
    dashboard,
    scadenze,
    habits_api,
    mood_api,
)

# Create main router
router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
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
router.include_router(habits.router)
router.include_router(mood.router)
router.include_router(budget.router)
router.include_router(ctf.router)
router.include_router(meals.router)
router.include_router(weather.router)
router.include_router(feed.router)
router.include_router(dashboard.router)
router.include_router(scadenze.router)
router.include_router(habits_api.router)
router.include_router(mood_api.router)
