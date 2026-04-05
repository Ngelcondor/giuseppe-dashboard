"""Focus and productivity endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, date
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.focus import PomodoroSession, FocusScore
from app.schemas.focus import (
    PomodoroSessionCreate, PomodoroSessionResponse, PomodoroSessionUpdate,
    PomodoroStartRequest, PomodoroStopRequest,
    FocusScoreCreate, FocusScoreResponse,
    FocusStatsResponse,
)

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post("/pomodoro/start", response_model=PomodoroSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_pomodoro(
    request: PomodoroStartRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PomodoroSessionResponse:
    """Start a Pomodoro session."""
    session = PomodoroSession(
        user_id=current_user["sub"],
        task_name=request.task_name,
        duration_minutes=request.duration_minutes,
        break_duration=request.break_duration,
        category=request.category,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return PomodoroSessionResponse.from_orm(session)


@router.post("/pomodoro/{session_id}/stop", response_model=PomodoroSessionResponse)
async def stop_pomodoro(
    session_id: str,
    request: PomodoroStopRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PomodoroSessionResponse:
    """Stop a Pomodoro session."""
    result = await db.execute(
        select(PomodoroSession).where(
            (PomodoroSession.id == session_id)
            & (PomodoroSession.user_id == current_user["sub"])
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.ended_at = datetime.utcnow()
    session.completed = request.completed
    session.notes = request.notes

    db.add(session)
    await db.commit()
    await db.refresh(session)
    return PomodoroSessionResponse.from_orm(session)


@router.get("/pomodoro/sessions", response_model=List[PomodoroSessionResponse])
async def list_pomodoro_sessions(
    days: int = Query(7),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[PomodoroSessionResponse]:
    """List Pomodoro sessions."""
    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(PomodoroSession)
        .where(
            (PomodoroSession.user_id == current_user["sub"])
            & (PomodoroSession.started_at >= start_date)
        )
        .order_by(PomodoroSession.started_at.desc())
    )
    sessions = result.scalars().all()
    return [PomodoroSessionResponse.from_orm(s) for s in sessions]


@router.post("/score", response_model=FocusScoreResponse, status_code=status.HTTP_201_CREATED)
async def create_focus_score(
    score: FocusScoreCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FocusScoreResponse:
    """Create a focus score entry."""
    focus_score = FocusScore(
        user_id=current_user["sub"],
        **score.dict(),
    )
    db.add(focus_score)
    await db.commit()
    await db.refresh(focus_score)
    return FocusScoreResponse.from_orm(focus_score)


@router.get("/score/today", response_model=FocusScoreResponse)
async def get_today_focus_score(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FocusScoreResponse:
    """Get today's focus score."""
    today = date.today()
    result = await db.execute(
        select(FocusScore).where(
            (FocusScore.user_id == current_user["sub"])
            & (FocusScore.date == today)
        )
    )
    score = result.scalars().first()
    if not score:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No focus score for today")
    return FocusScoreResponse.from_orm(score)


@router.get("/score/history", response_model=List[FocusScoreResponse])
async def get_focus_score_history(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[FocusScoreResponse]:
    """Get focus score history."""
    start_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(FocusScore)
        .where(
            (FocusScore.user_id == current_user["sub"])
            & (FocusScore.date >= start_date)
        )
        .order_by(FocusScore.date.desc())
    )
    scores = result.scalars().all()
    return [FocusScoreResponse.from_orm(s) for s in scores]


@router.get("/stats", response_model=FocusStatsResponse)
async def get_focus_stats(
    period: str = Query("week"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FocusStatsResponse:
    """Get focus statistics."""
    if period == "week":
        days = 7
    elif period == "month":
        days = 30
    else:
        days = 7

    start_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(FocusScore)
        .where(
            (FocusScore.user_id == current_user["sub"])
            & (FocusScore.date >= start_date)
        )
        .order_by(FocusScore.date)
    )
    scores = result.scalars().all()

    if not scores:
        return FocusStatsResponse(
            period=period,
            average_score=0.0,
            total_focus_hours=0.0,
            scores=[],
        )

    score_values = [s.score for s in scores]
    focus_hours = sum(s.focus_hours or 0 for s in scores)
    best_day = min(scores, key=lambda x: x.date).date if scores else None
    worst_day = max(scores, key=lambda x: x.date).date if scores else None

    return FocusStatsResponse(
        period=period,
        average_score=sum(score_values) / len(score_values),
        best_day=best_day,
        worst_day=worst_day,
        total_focus_hours=focus_hours,
        scores=[FocusScoreResponse.from_orm(s) for s in scores],
    )
