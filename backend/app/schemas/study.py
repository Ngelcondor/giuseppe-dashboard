"""Study plan task state schemas."""
from datetime import datetime, date
from typing import List, Optional
from uuid import UUID

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


# ── CPTS plan (server-persisted modules + sections) ───────────────────────────
class StudyModuleSectionOut(BaseModel):
    """A single subchapter (HTB section) inside a module."""

    id: UUID
    order_index: int
    title: str
    completed: bool
    completed_at: Optional[datetime] = None
    obsidian_link: Optional[str] = None

    class Config:
        from_attributes = True


class StudyModuleSectionUpdate(BaseModel):
    """Editable per-section fields. Omitted fields keep their current value."""

    completed: Optional[bool] = None
    # Empty string clears the link; null leaves it unchanged.
    obsidian_link: Optional[str] = None


class StudyModuleOut(BaseModel):
    """A single CPTS module surfaced to the Studio page, with its sections."""

    id: UUID
    order_index: int
    title: str
    brief: Optional[str] = None
    htb_url: Optional[str] = None
    completed: bool
    completed_at: Optional[datetime] = None
    obsidian_link: Optional[str] = None
    sections: List[StudyModuleSectionOut] = []
    sections_done: int = 0
    sections_total: int = 0

    class Config:
        from_attributes = True


class StudyModuleUpdate(BaseModel):
    """Editable per-module fields. Omitted fields keep their current value."""

    completed: Optional[bool] = None
    # Empty string clears the value; null leaves it unchanged.
    obsidian_link: Optional[str] = None
    htb_url: Optional[str] = None


class StudyPlanOut(BaseModel):
    """The full CPTS plan: timeline + ordered module list."""

    start_date: date
    current_week: int
    total_weeks: int
    modules: List[StudyModuleOut]
    completed_count: int            # modules fully completed
    total_count: int               # modules
    sections_done: int = 0         # subchapters completed across all modules
    sections_total: int = 0        # subchapters across all modules


class StudyResetRequest(BaseModel):
    """Reinitialize the plan to the canonical CPTS module sequence."""

    # Defaults to the CPTS kickoff date when omitted.
    start_date: date = date(2026, 6, 22)


# ── HTB profile (read via settings_store; honest not_connected fallback) ──────
class HTBProfile(BaseModel):
    """HTB stats panel payload. ``connected=False`` => render the CTA, no stats."""

    connected: bool
    name: Optional[str] = None
    rank: Optional[str] = None
    points: Optional[int] = None
    user_owns: Optional[int] = None
    system_owns: Optional[int] = None
    ranking: Optional[int] = None
    user_bloods: Optional[int] = None
    system_bloods: Optional[int] = None
    avatar: Optional[str] = None
    country: Optional[str] = None
    # Present when connected=False to explain why (e.g. token rejected by HTB).
    detail: Optional[str] = None
