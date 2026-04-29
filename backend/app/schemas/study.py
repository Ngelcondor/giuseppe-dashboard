"""Study plan task state schemas."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class StudyTaskStateOut(BaseModel):
    """Per-task state returned by the API."""

    task_id: str
    completed: bool
    completed_at: Optional[datetime] = None
    skipped: bool
    moved_to_date: Optional[str] = None

    class Config:
        from_attributes = True


class StudyTaskUpsert(BaseModel):
    """Partial update for a single task. Any field omitted leaves current value."""

    completed: Optional[bool] = None
    skipped: Optional[bool] = None
    moved_to_date: Optional[str] = None  # use empty string to clear


class StudyBatchEntry(StudyTaskUpsert):
    """Bulk upsert entry."""

    task_id: str
