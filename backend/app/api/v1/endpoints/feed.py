"""RSS feed endpoints for cybersecurity news."""
from fastapi import APIRouter, Depends
from typing import List

from app.core.security import get_current_user

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/cybersecurity")
async def get_cybersecurity_feed(
    current_user: dict = Depends(get_current_user),
):
    """Get cybersecurity news feed."""
    # Mock feed response
    return {
        "articles": [
            {
                "title": "New CVE-2026-1234 Discovered",
                "source": "HackerNews",
                "link": "https://example.com/article1",
                "published": "2026-03-28T10:00:00Z",
                "summary": "A critical vulnerability was discovered in...",
            },
            {
                "title": "CTF Competition Results",
                "source": "CTFTime",
                "link": "https://example.com/article2",
                "published": "2026-03-27T15:30:00Z",
                "summary": "Top teams compete in the latest CTF...",
            },
        ]
    }
