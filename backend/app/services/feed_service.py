"""RSS feed service for cybersecurity news."""
from typing import List, Dict, Any
import feedparser

from app.core.redis import get_cached, set_cached


CYBERSEC_FEEDS = [
    "https://feeds.arstechnica.com/arstechnica/security",
    "https://www.darkreading.com/feed/rss/",
    "https://www.securityweek.com/feed/",
]


async def fetch_cybersecurity_feed() -> List[Dict[str, Any]]:
    """
    Fetch cybersecurity news from RSS feeds with caching.

    Returns:
        List of articles.
    """
    cache_key = "cybersec_feed"

    # Try cache first
    cached = await get_cached(cache_key)
    if cached:
        return cached

    articles = []

    for feed_url in CYBERSEC_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:3]:  # Get top 3 articles per feed
                article = {
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "summary": entry.get("summary", "")[:200],
                    "source": feed.feed.get("title", "Unknown"),
                }
                articles.append(article)
        except Exception:
            continue

    # Cache for 1 hour
    await set_cached(cache_key, articles, expiry=3600)
    return articles
