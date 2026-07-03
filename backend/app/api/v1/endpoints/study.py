"""Study plan endpoints.

Authenticated. Two concerns live here:

* Legacy per-task state sync (``/study/state`` etc.) for the old day-based plan.
* The CPTS curriculum: a server-persisted, resettable module list with Obsidian
  links + completion toggles, plus a real HTB profile panel that reads the
  ``htb`` integration setting. No fabricated stats or completion anywhere.
"""
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.core.sections import get_view_user_id
from app.models.study import (
    StudyTaskState,
    StudyPlan,
    StudyModule,
    StudyModuleSection,
    CPTS_CURRICULUM,
    CPTS_TOTAL_WEEKS,
    htb_module_url,
)
from app.schemas.study import (
    StudyBatchEntry,
    StudyTaskStateOut,
    StudyTaskUpsert,
    StudyPlanOut,
    StudyModuleOut,
    StudyModuleSectionOut,
    StudyModuleUpdate,
    StudyModuleSectionUpdate,
    StudyResetRequest,
    HTBProfile,
)
from app.services import settings_store
from app.services.htb_service import fetch_htb_profile

router = APIRouter(
    prefix="/study",
    tags=["study"],
    dependencies=[Depends(get_current_user)],
)


async def _get_or_create(db: AsyncSession, user_id: UUID, task_id: str) -> StudyTaskState:
    result = await db.execute(
        select(StudyTaskState).where(
            StudyTaskState.user_id == user_id,
            StudyTaskState.task_id == task_id,
        )
    )
    row = result.scalars().first()
    if row is None:
        row = StudyTaskState(user_id=user_id, task_id=task_id)
        db.add(row)
    return row


def _apply(row: StudyTaskState, upd: StudyTaskUpsert) -> None:
    if upd.completed is not None:
        row.completed = upd.completed
        row.completed_at = datetime.utcnow() if upd.completed else None
        if upd.completed:
            row.skipped = False
    if upd.skipped is not None:
        row.skipped = upd.skipped
        if upd.skipped:
            row.completed = False
            row.completed_at = None
    if upd.moved_to_date is not None:
        row.moved_to_date = upd.moved_to_date or None  # empty string clears


@router.get("/state", response_model=List[StudyTaskStateOut])
async def get_state(
    db: AsyncSession = Depends(get_db),
    view_user_id: str = Depends(get_view_user_id),
):
    """Return all task states for the current user."""
    user_id = UUID(view_user_id)
    result = await db.execute(
        select(StudyTaskState).where(StudyTaskState.user_id == user_id)
    )
    return list(result.scalars().all())


@router.put("/task/{task_id}", response_model=StudyTaskStateOut)
async def upsert_task(
    task_id: str,
    body: StudyTaskUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Upsert state for a single task."""
    user_id = UUID(current_user["sub"])
    row = await _get_or_create(db, user_id, task_id)
    _apply(row, body)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/state/batch", response_model=List[StudyTaskStateOut])
async def upsert_batch(
    entries: List[StudyBatchEntry],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Bulk upsert — used for reschedule operations that touch many tasks at once."""
    user_id = UUID(current_user["sub"])
    out: List[StudyTaskState] = []
    for e in entries:
        row = await _get_or_create(db, user_id, e.task_id)
        _apply(row, StudyTaskUpsert(completed=e.completed, skipped=e.skipped, moved_to_date=e.moved_to_date))
        out.append(row)
    await db.commit()
    for row in out:
        await db.refresh(row)
    return out


@router.delete("/state", status_code=204)
async def reset_state(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Wipe all study task state for the current user."""
    user_id = UUID(current_user["sub"])
    await db.execute(
        delete(StudyTaskState).where(StudyTaskState.user_id == user_id)
    )
    await db.commit()


# ── CPTS plan (server-persisted modules) ──────────────────────────────────────


def _module_out(module: StudyModule, sections: list[StudyModuleSection]) -> StudyModuleOut:
    """Build a StudyModuleOut from a module + its (ordered) sections."""
    secs = sorted(sections, key=lambda s: s.order_index)
    done = sum(1 for s in secs if s.completed)
    return StudyModuleOut(
        id=module.id,
        order_index=module.order_index,
        title=module.title,
        brief=module.brief,
        htb_url=module.htb_url,
        completed=module.completed,
        completed_at=module.completed_at,
        obsidian_link=module.obsidian_link,
        sections=[StudyModuleSectionOut.model_validate(s) for s in secs],
        sections_done=done,
        sections_total=len(secs),
    )


async def _load_module_out(db: AsyncSession, module: StudyModule) -> StudyModuleOut:
    secs = (
        await db.execute(
            select(StudyModuleSection).where(StudyModuleSection.module_id == module.id)
        )
    ).scalars().all()
    return _module_out(module, list(secs))


async def _serialize_plan(db: AsyncSession, plan: StudyPlan) -> StudyPlanOut:
    """Build the StudyPlanOut for a plan, loading its ordered modules + sections."""
    mod_rows = (
        await db.execute(
            select(StudyModule)
            .where(StudyModule.plan_id == plan.id)
            .order_by(StudyModule.order_index)
        )
    ).scalars().all()
    mod_ids = [m.id for m in mod_rows]
    sec_rows: list[StudyModuleSection] = []
    if mod_ids:
        sec_rows = list(
            (
                await db.execute(
                    select(StudyModuleSection).where(StudyModuleSection.module_id.in_(mod_ids))
                )
            ).scalars().all()
        )
    by_mod: dict = {}
    for s in sec_rows:
        by_mod.setdefault(s.module_id, []).append(s)

    modules = [_module_out(m, by_mod.get(m.id, [])) for m in mod_rows]
    return StudyPlanOut(
        start_date=plan.start_date,
        current_week=plan.current_week,
        total_weeks=CPTS_TOTAL_WEEKS,
        modules=modules,
        completed_count=sum(1 for m in mod_rows if m.completed),
        total_count=len(mod_rows),
        sections_done=sum(1 for s in sec_rows if s.completed),
        sections_total=len(sec_rows),
    )


@router.get("/plan", response_model=StudyPlanOut)
async def get_plan(
    db: AsyncSession = Depends(get_db),
    view_user_id: str = Depends(get_view_user_id),
) -> StudyPlanOut:
    """Return the current user's CPTS plan.

    If the user has never initialised a plan, returns an empty plan (no modules)
    — the Studio page shows a 'Reset percorso' CTA. No fabricated rows.
    """
    user_id = UUID(view_user_id)
    plan = (
        await db.execute(select(StudyPlan).where(StudyPlan.user_id == user_id))
    ).scalars().first()
    if plan is None:
        from datetime import date as _date

        return StudyPlanOut(
            start_date=_date(2026, 6, 22),
            current_week=1,
            total_weeks=CPTS_TOTAL_WEEKS,
            modules=[],
            completed_count=0,
            total_count=0,
        )
    return await _serialize_plan(db, plan)


@router.post("/reset", response_model=StudyPlanOut)
async def reset_plan(
    body: StudyResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
) -> StudyPlanOut:
    """(Re)initialise the CPTS plan to the canonical module sequence.

    Wipes the existing plan + modules for the user, recreates the plan at week 1
    with the given start_date, and seeds every CPTS module NOT done with no
    Obsidian link. Editor-only.
    """
    user_id = UUID(current_user["sub"])

    # Drop existing sections + modules + plan for a clean slate.
    await db.execute(delete(StudyModuleSection).where(StudyModuleSection.user_id == user_id))
    await db.execute(delete(StudyModule).where(StudyModule.user_id == user_id))
    await db.execute(delete(StudyPlan).where(StudyPlan.user_id == user_id))
    await db.flush()

    plan = StudyPlan(
        user_id=user_id,
        start_date=body.start_date,
        current_week=1,
    )
    db.add(plan)
    await db.flush()  # assign plan.id

    for idx, entry in enumerate(CPTS_CURRICULUM):
        module = StudyModule(
            user_id=user_id,
            plan_id=plan.id,
            order_index=idx,
            title=entry["title"],
            brief=entry.get("brief"),
            htb_url=htb_module_url(entry.get("htb_id")),
            completed=False,
            obsidian_link=None,
        )
        db.add(module)
        await db.flush()  # assign module.id
        for s_idx, s_title in enumerate(entry.get("sections", [])):
            db.add(
                StudyModuleSection(
                    user_id=user_id,
                    module_id=module.id,
                    order_index=s_idx,
                    title=s_title,
                    completed=False,
                    obsidian_link=None,
                )
            )

    await db.commit()
    await db.refresh(plan)
    return await _serialize_plan(db, plan)


@router.put("/modules/{module_id}", response_model=StudyModuleOut)
async def update_module(
    module_id: UUID,
    body: StudyModuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
) -> StudyModuleOut:
    """Update a module's completion, Obsidian link and/or HTB URL. Editor-only.

    Toggling ``completed`` is a bulk action: it cascades to every section so the
    module and its subchapters stay consistent.
    """
    user_id = UUID(current_user["sub"])
    module = (
        await db.execute(
            select(StudyModule).where(
                StudyModule.id == module_id,
                StudyModule.user_id == user_id,
            )
        )
    ).scalars().first()
    if module is None:
        raise HTTPException(status_code=404, detail="Modulo non trovato")

    if body.completed is not None:
        now = datetime.utcnow()
        module.completed = body.completed
        module.completed_at = now if body.completed else None
        sections = (
            await db.execute(
                select(StudyModuleSection).where(StudyModuleSection.module_id == module.id)
            )
        ).scalars().all()
        for s in sections:
            s.completed = body.completed
            s.completed_at = now if body.completed else None
    if body.obsidian_link is not None:
        module.obsidian_link = body.obsidian_link.strip() or None
    if body.htb_url is not None:
        module.htb_url = body.htb_url.strip() or None

    await db.commit()
    await db.refresh(module)
    return await _load_module_out(db, module)


@router.put("/sections/{section_id}", response_model=StudyModuleOut)
async def update_section(
    section_id: UUID,
    body: StudyModuleSectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_editor),
) -> StudyModuleOut:
    """Update a subchapter's completion and/or Obsidian link. Editor-only.

    Returns the parent module (with refreshed section progress); the module's
    own ``completed`` flag is derived = every section completed.
    """
    user_id = UUID(current_user["sub"])
    section = (
        await db.execute(
            select(StudyModuleSection).where(
                StudyModuleSection.id == section_id,
                StudyModuleSection.user_id == user_id,
            )
        )
    ).scalars().first()
    if section is None:
        raise HTTPException(status_code=404, detail="Sezione non trovata")

    if body.completed is not None:
        section.completed = body.completed
        section.completed_at = datetime.utcnow() if body.completed else None
    if body.obsidian_link is not None:
        section.obsidian_link = body.obsidian_link.strip() or None
    await db.flush()

    module = (
        await db.execute(
            select(StudyModule).where(StudyModule.id == section.module_id)
        )
    ).scalars().first()
    siblings = (
        await db.execute(
            select(StudyModuleSection).where(StudyModuleSection.module_id == section.module_id)
        )
    ).scalars().all()
    all_done = len(siblings) > 0 and all(s.completed for s in siblings)
    if module.completed != all_done:
        module.completed = all_done
        module.completed_at = datetime.utcnow() if all_done else None

    await db.commit()
    await db.refresh(module)
    return await _load_module_out(db, module)


# ── HTB profile (real stats or honest not_connected) ──────────────────────────


@router.get("/htb/profile", response_model=HTBProfile)
async def htb_profile(
    db: AsyncSession = Depends(get_db),
    view_user_id: str = Depends(get_view_user_id),
) -> HTBProfile:
    """Return the user's real HTB stats, or ``connected=False`` if not configured.

    Reads the ``htb`` integration setting ({api_token}) via the shared store. If
    absent/empty, or if the HTB API call fails, returns an honest not_connected
    payload — never fabricated stats.
    """
    user_id = UUID(view_user_id)
    cfg = await settings_store.get_setting(db, user_id, "htb")
    token = (cfg or {}).get("api_token") if isinstance(cfg, dict) else None
    if not token:
        return HTBProfile(connected=False, detail="HTB non collegato.")

    data = await fetch_htb_profile(token)
    return HTBProfile(**data)
