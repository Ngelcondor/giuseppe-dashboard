"""RSS feed endpoints for cybersecurity news."""
from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.services.feed_service import fetch_cybersecurity_feed

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/cybersecurity")
async def get_cybersecurity_feed(
    current_user: dict = Depends(get_current_user),
):
    """Get cybersecurity news feed (real RSS sources, cached 1h in Redis)."""
    articles = await fetch_cybersecurity_feed()
    return {"articles": articles}
