"""Weather endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current")
async def get_current_weather(
    latitude: float = Query(...),
    longitude: float = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Get current weather for coordinates."""
    if not settings.WEATHER_API_KEY:
        return {
            "temp": 72,
            "feels_like": 70,
            "humidity": 65,
            "description": "Sunny",
            "icon": "01d",
        }

    # In production, call OpenWeatherMap API
    return {
        "temp": 72,
        "feels_like": 70,
        "humidity": 65,
        "description": "Sunny",
        "icon": "01d",
    }


@router.get("/forecast")
async def get_weather_forecast(
    latitude: float = Query(...),
    longitude: float = Query(...),
    days: int = Query(7),
    current_user: dict = Depends(get_current_user),
):
    """Get weather forecast."""
    if not settings.WEATHER_API_KEY:
        return {
            "forecast": [
                {"date": "2026-03-28", "temp_high": 75, "temp_low": 65, "description": "Sunny"},
                {"date": "2026-03-29", "temp_high": 72, "temp_low": 62, "description": "Partly Cloudy"},
            ]
        }

    return {
        "forecast": [
            {"date": "2026-03-28", "temp_high": 75, "temp_low": 65, "description": "Sunny"},
            {"date": "2026-03-29", "temp_high": 72, "temp_low": 62, "description": "Partly Cloudy"},
        ]
    }
