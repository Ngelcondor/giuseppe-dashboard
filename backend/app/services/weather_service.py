"""Weather service with caching."""
from typing import Optional, Dict, Any
import httpx

from app.core.redis import get_cached, set_cached
from app.core.config import settings


async def get_weather(latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
    """
    Get current weather for coordinates with caching.

    Args:
        latitude: Latitude coordinate.
        longitude: Longitude coordinate.

    Returns:
        Weather data or None.
    """
    cache_key = f"weather:{latitude}:{longitude}"

    # Try cache first
    cached = await get_cached(cache_key)
    if cached:
        return cached

    if not settings.WEATHER_API_KEY:
        return None

    try:
        async with httpx.AsyncClient() as client:
            url = f"{settings.OPENWEATHERMAP_API_URL}/weather"
            params = {
                "lat": latitude,
                "lon": longitude,
                "appid": settings.WEATHER_API_KEY,
                "units": "metric",
            }
            response = await client.get(url, params=params, timeout=5.0)
            response.raise_for_status()

            data = response.json()
            weather_data = {
                "temp": data["main"]["temp"],
                "feels_like": data["main"]["feels_like"],
                "humidity": data["main"]["humidity"],
                "description": data["weather"][0]["description"],
                "icon": data["weather"][0]["icon"],
            }

            # Cache for 30 minutes
            await set_cached(cache_key, weather_data, expiry=1800)
            return weather_data
    except Exception:
        return None


async def get_forecast(latitude: float, longitude: float, days: int = 7) -> Optional[Dict[str, Any]]:
    """
    Get weather forecast with caching.

    Args:
        latitude: Latitude coordinate.
        longitude: Longitude coordinate.
        days: Number of days for forecast.

    Returns:
        Forecast data or None.
    """
    cache_key = f"forecast:{latitude}:{longitude}:{days}"

    # Try cache first
    cached = await get_cached(cache_key)
    if cached:
        return cached

    if not settings.WEATHER_API_KEY:
        return None

    try:
        async with httpx.AsyncClient() as client:
            url = f"{settings.OPENWEATHERMAP_API_URL}/forecast"
            params = {
                "lat": latitude,
                "lon": longitude,
                "appid": settings.WEATHER_API_KEY,
                "units": "metric",
                "cnt": days * 8,  # 8 forecasts per day (3-hour intervals)
            }
            response = await client.get(url, params=params, timeout=5.0)
            response.raise_for_status()

            data = response.json()
            forecast_list = data["list"]

            forecast_data = {
                "forecast": [
                    {
                        "date": item["dt_txt"],
                        "temp": item["main"]["temp"],
                        "temp_high": item["main"]["temp_max"],
                        "temp_low": item["main"]["temp_min"],
                        "description": item["weather"][0]["description"],
                    }
                    for item in forecast_list[:days]
                ]
            }

            # Cache for 1 hour
            await set_cached(cache_key, forecast_data, expiry=3600)
            return forecast_data
    except Exception:
        return None
