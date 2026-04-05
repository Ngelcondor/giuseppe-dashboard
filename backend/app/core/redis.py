"""Redis configuration and caching utilities."""
import json
from typing import Any, Optional
import redis.asyncio as redis
from redis.asyncio import Redis

from app.core.config import settings

# Redis connection pool
redis_pool: Optional[Redis] = None


async def init_redis() -> Redis:
    """
    Initialize Redis connection.

    Returns:
        Redis: Redis client instance.
    """
    global redis_pool
    redis_pool = redis.from_url(
        settings.REDIS_URL,
        encoding="utf8",
        decode_responses=True,
    )
    return redis_pool


async def close_redis() -> None:
    """Close Redis connection."""
    global redis_pool
    if redis_pool:
        await redis_pool.close()


async def get_redis() -> Redis:
    """
    Get Redis connection.

    Returns:
        Redis: Redis client instance.
    """
    global redis_pool
    if not redis_pool:
        await init_redis()
    return redis_pool


async def get_cached(key: str) -> Optional[Any]:
    """
    Get value from cache.

    Args:
        key: Cache key.

    Returns:
        Optional[Any]: Cached value or None.
    """
    try:
        client = await get_redis()
        value = await client.get(key)
        if value:
            return json.loads(value)
    except Exception:
        pass
    return None


async def set_cached(
    key: str,
    value: Any,
    expiry: Optional[int] = None,
) -> bool:
    """
    Set value in cache.

    Args:
        key: Cache key.
        value: Value to cache.
        expiry: Expiration time in seconds.

    Returns:
        bool: True if successful.
    """
    try:
        client = await get_redis()
        expiry_seconds = expiry or settings.REDIS_CACHE_EXPIRY
        await client.setex(key, expiry_seconds, json.dumps(value))
        return True
    except Exception:
        return False


async def invalidate_cache(key: str) -> bool:
    """
    Invalidate cache key.

    Args:
        key: Cache key to invalidate.

    Returns:
        bool: True if successful.
    """
    try:
        client = await get_redis()
        await client.delete(key)
        return True
    except Exception:
        return False


async def invalidate_cache_pattern(pattern: str) -> int:
    """
    Invalidate cache keys matching a pattern.

    Args:
        pattern: Pattern to match (e.g., "user:123:*").

    Returns:
        int: Number of keys deleted.
    """
    try:
        client = await get_redis()
        keys = await client.keys(pattern)
        if keys:
            return await client.delete(*keys)
    except Exception:
        pass
    return 0
