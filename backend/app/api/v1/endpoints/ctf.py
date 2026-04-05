"""CTF challenge endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ctf import CTFPlatform, CTFChallenge
from app.schemas.ctf import (
    CTFPlatformCreate, CTFPlatformResponse, CTFPlatformUpdate,
    CTFChallengeCreate, CTFChallengeResponse, CTFChallengeUpdate,
    CTFStats, CTFProgress,
)

router = APIRouter(prefix="/ctf", tags=["ctf"])


@router.post("/platforms", response_model=CTFPlatformResponse, status_code=status.HTTP_201_CREATED)
async def create_ctf_platform(
    platform: CTFPlatformCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFPlatformResponse:
    """Add a CTF platform."""
    ctf_platform = CTFPlatform(
        user_id=current_user["sub"],
        **platform.dict(),
    )
    db.add(ctf_platform)
    await db.commit()
    await db.refresh(ctf_platform)
    return CTFPlatformResponse.from_orm(ctf_platform)


@router.get("/platforms", response_model=List[CTFPlatformResponse])
async def list_ctf_platforms(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CTFPlatformResponse]:
    """List CTF platforms."""
    result = await db.execute(
        select(CTFPlatform).where(CTFPlatform.user_id == current_user["sub"])
    )
    platforms = result.scalars().all()
    return [CTFPlatformResponse.from_orm(p) for p in platforms]


@router.get("/platforms/{platform_id}", response_model=CTFPlatformResponse)
async def get_ctf_platform(
    platform_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFPlatformResponse:
    """Get a specific CTF platform."""
    result = await db.execute(
        select(CTFPlatform).where(
            (CTFPlatform.id == platform_id)
            & (CTFPlatform.user_id == current_user["sub"])
        )
    )
    platform = result.scalars().first()
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform not found")
    return CTFPlatformResponse.from_orm(platform)


@router.put("/platforms/{platform_id}", response_model=CTFPlatformResponse)
async def update_ctf_platform(
    platform_id: str,
    platform_update: CTFPlatformUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFPlatformResponse:
    """Update a CTF platform."""
    result = await db.execute(
        select(CTFPlatform).where(
            (CTFPlatform.id == platform_id)
            & (CTFPlatform.user_id == current_user["sub"])
        )
    )
    platform = result.scalars().first()
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform not found")

    update_data = platform_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(platform, field, value)

    db.add(platform)
    await db.commit()
    await db.refresh(platform)
    return CTFPlatformResponse.from_orm(platform)


@router.delete("/platforms/{platform_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ctf_platform(
    platform_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a CTF platform."""
    result = await db.execute(
        select(CTFPlatform).where(
            (CTFPlatform.id == platform_id)
            & (CTFPlatform.user_id == current_user["sub"])
        )
    )
    platform = result.scalars().first()
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform not found")

    await db.delete(platform)
    await db.commit()


# Challenges
@router.post("/challenges", response_model=CTFChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_ctf_challenge(
    challenge: CTFChallengeCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFChallengeResponse:
    """Create a CTF challenge."""
    ctf_challenge = CTFChallenge(
        user_id=current_user["sub"],
        **challenge.dict(),
    )
    db.add(ctf_challenge)
    await db.commit()
    await db.refresh(ctf_challenge)
    return CTFChallengeResponse.from_orm(ctf_challenge)


@router.get("/challenges", response_model=List[CTFChallengeResponse])
async def list_ctf_challenges(
    platform_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CTFChallengeResponse]:
    """List CTF challenges."""
    query = select(CTFChallenge).where(CTFChallenge.user_id == current_user["sub"])

    if platform_id:
        query = query.where(CTFChallenge.platform_id == platform_id)

    result = await db.execute(query.order_by(CTFChallenge.created_at.desc()))
    challenges = result.scalars().all()
    return [CTFChallengeResponse.from_orm(c) for c in challenges]


@router.get("/challenges/{challenge_id}", response_model=CTFChallengeResponse)
async def get_ctf_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFChallengeResponse:
    """Get a specific CTF challenge."""
    result = await db.execute(
        select(CTFChallenge).where(
            (CTFChallenge.id == challenge_id)
            & (CTFChallenge.user_id == current_user["sub"])
        )
    )
    challenge = result.scalars().first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    return CTFChallengeResponse.from_orm(challenge)


@router.put("/challenges/{challenge_id}", response_model=CTFChallengeResponse)
async def update_ctf_challenge(
    challenge_id: str,
    challenge_update: CTFChallengeUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFChallengeResponse:
    """Update a CTF challenge."""
    result = await db.execute(
        select(CTFChallenge).where(
            (CTFChallenge.id == challenge_id)
            & (CTFChallenge.user_id == current_user["sub"])
        )
    )
    challenge = result.scalars().first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    update_data = challenge_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(challenge, field, value)

    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return CTFChallengeResponse.from_orm(challenge)


@router.delete("/challenges/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ctf_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a CTF challenge."""
    result = await db.execute(
        select(CTFChallenge).where(
            (CTFChallenge.id == challenge_id)
            & (CTFChallenge.user_id == current_user["sub"])
        )
    )
    challenge = result.scalars().first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    await db.delete(challenge)
    await db.commit()


@router.get("/stats", response_model=CTFStats)
async def get_ctf_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFStats:
    """Get CTF statistics."""
    result = await db.execute(
        select(CTFChallenge).where(CTFChallenge.user_id == current_user["sub"])
    )
    challenges = result.scalars().all()

    total = len(challenges)
    completed = sum(1 for c in challenges if c.is_completed)
    completion_rate = (completed / total * 100) if total > 0 else 0

    by_category = {}
    by_difficulty = {}
    total_time = 0

    for challenge in challenges:
        cat = challenge.category.value
        by_category[cat] = by_category.get(cat, 0) + 1

        if challenge.difficulty:
            diff = challenge.difficulty.value
            by_difficulty[diff] = by_difficulty.get(diff, 0) + 1

        if challenge.time_spent_minutes:
            total_time += challenge.time_spent_minutes

    return CTFStats(
        total_challenges=total,
        completed_challenges=completed,
        completion_rate=completion_rate,
        by_category=by_category,
        by_difficulty=by_difficulty,
        total_time_spent_hours=total_time / 60,
    )


@router.get("/progress/{platform_id}", response_model=CTFProgress)
async def get_ctf_progress(
    platform_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CTFProgress:
    """Get CTF progress for a platform."""
    result = await db.execute(
        select(CTFPlatform).where(
            (CTFPlatform.id == platform_id)
            & (CTFPlatform.user_id == current_user["sub"])
        )
    )
    platform = result.scalars().first()
    if not platform:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform not found")

    result = await db.execute(
        select(CTFChallenge).where(CTFChallenge.platform_id == platform_id)
    )
    challenges = result.scalars().all()

    total = len(challenges)
    completed = sum(1 for c in challenges if c.is_completed)
    completion_rate = (completed / total * 100) if total > 0 else 0

    recent = sorted(challenges, key=lambda x: x.created_at, reverse=True)[:5]

    return CTFProgress(
        platform=platform.platform_name,
        username=platform.username,
        total_challenges=total,
        completed_challenges=completed,
        completion_rate=completion_rate,
        recent_challenges=[CTFChallengeResponse.from_orm(c) for c in recent],
    )
