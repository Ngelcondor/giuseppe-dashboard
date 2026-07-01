"""RSS feed service for cybersecurity news."""
import asyncio
import logging
from calendar import timegm
from typing import List, Dict, Any

import feedparser

from app.core.redis import get_cached, set_cached

logger = logging.getLogger(__name__)

CYBERSEC_FEEDS = [
    "https://arstechnica.com/security/feed/",
    "https://www.darkreading.com/rss.xml",
    "https://www.securityweek.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
]

ARTICLES_PER_FEED = 3


async def fetch_cybersecurity_feed() -> List[Dict[str, Any]]:
    """
    Fetch cybersecurity news from RSS feeds with caching.

    Returns:
        List of articles, newest first.
    """
    cache_key = "cybersec_feed"

    # Try cache first
    cached = await get_cached(cache_key)
    if cached:
        return cached

    articles = []

    for feed_url in CYBERSEC_FEEDS:
        try:
            # feedparser is blocking (network + parse): keep it off the event loop
            feed = await asyncio.to_thread(feedparser.parse, feed_url)
            if feed.bozo and not feed.entries:
                logger.warning("RSS feed unusable: %s (%s)", feed_url, feed.bozo_exception)
                continue
            for entry in feed.entries[:ARTICLES_PER_FEED]:
                published_parsed = entry.get("published_parsed")
                article = {
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "published_ts": timegm(published_parsed) if published_parsed else 0,
                    "summary": entry.get("summary", "")[:200],
                    "source": feed.feed.get("title", "Unknown"),
                }
                articles.append(article)
        except Exception as exc:  # noqa: BLE001 — one bad feed must not kill the rest
            logger.warning("RSS feed fetch failed: %s (%s)", feed_url, exc)
            continue

    articles.sort(key=lambda a: a["published_ts"], reverse=True)

    # Cache for 1 hour
    await set_cached(cache_key, articles, expiry=3600)
    return articles
