"""Focus score calculation service."""
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.health import HealthMetric, MetricType
from app.models.focus import PomodoroSession
from app.schemas.focus import FocusScoreCreate


async def calculate_daily_focus_score(
    user_id: str,
    target_date: date,
    db: AsyncSession,
) -> Optional[FocusScoreCreate]:
    """
    Calculate daily focus score based on health metrics and productivity data.

    Args:
        user_id: User ID.
        target_date: Date to calculate score for.
        db: Database session.

    Returns:
        FocusScoreCreate object or None.
    """
    score = 50.0  # Base score

    # Get sleep data for previous night
    start_sleep = datetime.combine(target_date - timedelta(days=1), datetime.min.time())
    end_sleep = datetime.combine(target_date, datetime.min.time())

    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.user_id == user_id)
            & (HealthMetric.metric_type == MetricType.SLEEP)
            & (HealthMetric.recorded_at >= start_sleep)
            & (HealthMetric.recorded_at <= end_sleep)
        )
    )
    sleep_metrics = result.scalars().all()

    sleep_quality = None
    if sleep_metrics:
        avg_sleep = sum(m.value for m in sleep_metrics) / len(sleep_metrics)
        sleep_quality = min(10, avg_sleep / 60)  # Convert minutes to 1-10 scale
        # Adjust score based on sleep
        if avg_sleep >= 420:  # 7 hours
            score += 20
        elif avg_sleep >= 360:  # 6 hours
            score += 10
        else:
            score -= 10

    # Get heart rate data
    start_hr = datetime.combine(target_date, datetime.min.time())
    end_hr = datetime.combine(target_date, datetime.max.time())

    result = await db.execute(
        select(HealthMetric).where(
            (HealthMetric.user_id == user_id)
            & (HealthMetric.metric_type == MetricType.HEART_RATE)
            & (HealthMetric.recorded_at >= start_hr)
            & (HealthMetric.recorded_at <= end_hr)
        )
    )
    hr_metrics = result.scalars().all()

    resting_hr = None
    if hr_metrics:
        # Get lowest heart rate (resting)
        resting_hr = min(m.value for m in hr_metrics)
        # Lower resting HR is generally better
        if resting_hr <= 60:
            score += 15
        elif resting_hr <= 70:
            score += 10
        else:
            score -= 5

    # Get Pomodoro sessions
    result = await db.execute(
        select(PomodoroSession).where(
            (PomodoroSession.user_id == user_id)
            & (PomodoroSession.started_at >= start_hr)
            & (PomodoroSession.started_at <= end_hr)
        )
    )
    sessions = result.scalars().all()

    focus_hours = sum(
        (s.duration_minutes / 60) for s in sessions if s.completed
    ) if sessions else 0

    if focus_hours > 0:
        if focus_hours >= 4:
            score += 25
        elif focus_hours >= 2:
            score += 15
        else:
            score += 5

    # Cap score between 0 and 100
    score = max(0, min(100, score))

    return FocusScoreCreate(
        date=target_date,
        score=score,
        sleep_quality=sleep_quality,
        resting_hr=resting_hr,
        focus_hours=focus_hours,
    )
