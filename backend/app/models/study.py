"""Study plan models.

Two complementary stores live here:

* ``StudyTaskState`` — legacy per-task check/skip/move metadata for the old
  day-based frontend roadmap (``studyPlanData.ts``). Kept for backward compat.
* ``StudyPlan`` + ``StudyModule`` — the server-persisted CPTS curriculum used by
  the Studio page. A plan is a per-user singleton carrying the start date and the
  current week (1..13); its modules are the canonical HTB CPTS module sequence,
  each with a completion flag and an optional Obsidian link. Progress always
  starts at zero — no fabricated completion or hours.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from app.core.database import Base

# ── Canonical HTB CPTS module sequence ───────────────────────────────────────
# Module titles only (the real HTB Academy CPTS job-role path). NO fabricated
# completion, hours, or section counts — those are not stored. Used as the plan
# skeleton on POST /study/reset. Total: 13 weeks of effort across these modules.
CPTS_MODULES: list[str] = [
    "Penetration Testing Process",
    "Network Enumeration with Nmap",
    "Footprinting",
    "Information Gathering - Web Edition",
    "Vulnerability Assessment",
    "File Transfers",
    "Shells & Payloads",
    "Using the Metasploit Framework",
    "Password Attacks",
    "Attacking Common Services",
    "Pivoting, Tunneling, and Port Forwarding",
    "Active Directory Enumeration & Attacks",
    "Using Web Proxies",
    "Attacking Web Applications with Ffuf",
    "Login Brute Forcing",
    "SQL Injection Fundamentals",
    "SQLMap Essentials",
    "Cross-Site Scripting (XSS)",
    "File Inclusion",
    "File Upload Attacks",
    "Command Injections",
    "Web Attacks",
    "Attacking Common Applications",
    "Linux Privilege Escalation",
    "Windows Privilege Escalation",
    "Documentation & Reporting",
    "Attacking Enterprise Networks",
]

# CPTS exam/study horizon used by the Studio page header (settimana x / N).
CPTS_TOTAL_WEEKS: int = 13


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


class StudyPlan(Base):
    """Per-user CPTS study plan (singleton). Carries timeline metadata only."""

    __tablename__ = "study_plans"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_study_plan_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Day the plan begins (week 1). Defaults to the CPTS kickoff date.
    start_date = Column(Date, nullable=False, default=date(2026, 6, 22))
    # 1-based current week within the 13-week horizon.
    current_week = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyPlan(user_id={self.user_id}, start_date={self.start_date}, week={self.current_week})>"


class StudyModule(Base):
    """A single CPTS module row inside a user's plan.

    Title comes from the canonical CPTS sequence; completion starts at False and
    obsidian_link is null until the user pastes one (the vault is off-device).
    """

    __tablename__ = "study_modules"
    __table_args__ = (
        UniqueConstraint("user_id", "order_index", name="uq_study_module_user_order"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    plan_id = Column(
        UUID(as_uuid=True), ForeignKey("study_plans.id"), nullable=False, index=True
    )

    order_index = Column(Integer, nullable=False, default=0)
    title = Column(String(160), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    # obsidian:// URI or vault path; null until the user sets it. Never fabricated.
    obsidian_link = Column(String(1024), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyModule(order={self.order_index}, title={self.title!r}, completed={self.completed})>"
