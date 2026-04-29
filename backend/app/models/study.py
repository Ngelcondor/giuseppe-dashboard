"""Study plan task state — persists check/skip/move metadata for the CRTP roadmap.

The static plan (phases, weeks, days, task text) lives in the frontend file
`studyPlanData.ts`. This table only stores the *user-mutable* state per task,
keyed by the deterministic task_id the frontend generates (`${date}-${idx}`).
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class StudyTaskState(Base):
    """Per-task user state for the CRTP study plan."""

    __tablename__ = "study_task_states"
    __table_args__ = (
        UniqueConstraint("user_id", "task_id", name="uq_study_task_user_task"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Deterministic id from frontend: "YYYY-MM-DD-{idx}"
    # The date prefix encodes the original day; moved_to_date overrides the render target.
    task_id = Column(String(64), nullable=False, index=True)

    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    skipped = Column(Boolean, default=False, nullable=False)

    # If non-null, render this task on this date instead of its original date.
    moved_to_date = Column(String(10), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyTaskState(task_id={self.task_id}, completed={self.completed}, skipped={self.skipped})>"
