"""Bank → Scadenze auto-tick.

After every sync / CSV import, unpaid rate, subscription charges and one-off
payments are matched against the user's expense transactions (payee on the
statement, same amount ±2 cent, within ±7 days — see deadline_ledger). Each
match ticks the occurrence paid and links the transaction to it.

Safety rules (this writes user data):
  - only ever ADDS ticks, never removes one;
  - a linked transaction is never matched again (one charge, one tick);
  - an auto-tick the user undoes lands in auto_rejected_occurrences and is
    never re-ticked, even by another matching charge.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.budget import Transaction, TransactionType
from app.models.deadline import Deadline
from app.services.deadline_ledger import (
    DATE_WINDOW_DAYS,
    TxLite,
    date_set,
    occurrences_between,
    propose_matches,
)

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 120   # how far back an unpaid occurrence can still be matched
LOOKAHEAD_DAYS = 3    # charges sometimes land a few days before the due date


async def apply_auto_ticks(db: AsyncSession, user_id, *, today: Optional[date] = None, dry_run: bool = False) -> list[tuple]:
    """Match and tick; returns the (Row, TxLite) pairs applied (or proposed if dry_run)."""
    today = today or date.today()
    start, end = today - timedelta(days=LOOKBACK_DAYS), today + timedelta(days=LOOKAHEAD_DAYS)

    result = await db.execute(
        select(Deadline).where((Deadline.user_id == user_id) & (Deadline.amount.isnot(None)))
    )
    deadlines = result.scalars().all()
    rows = [r for d in deadlines for r in occurrences_between(d, start, end)]
    if not rows:
        return []
    rejected = {f"{d.id}@{iso}" for d in deadlines for iso in date_set(d.auto_rejected_occurrences)}

    result = await db.execute(
        select(Transaction).where(
            (Transaction.user_id == user_id)
            & (Transaction.transaction_type == TransactionType.EXPENSE)
            & (Transaction.linked_deadline_id.is_(None))
            & (Transaction.date >= start - timedelta(days=DATE_WINDOW_DAYS))
            & (Transaction.date <= today)
        )
    )
    tx_by_id = {t.id: t for t in result.scalars().all()}
    lites = [
        TxLite(t.id, t.date, float(t.amount), f"{t.description or ''} {t.merchant_name or ''}".lower())
        for t in tx_by_id.values()
    ]
    pairs = propose_matches(rows, lites, rejected=rejected)
    if dry_run or not pairs:
        return pairs

    for row, lite in pairs:
        d, iso = row.deadline, row.date.isoformat()
        if row.occurrence:
            # Reassign (not in-place) so SQLAlchemy detects the JSON change.
            d.paid_occurrences = sorted(date_set(d.paid_occurrences) | {iso})
        else:
            d.is_completed = True
            d.completed_at = datetime.utcnow()
        d.auto_paid_occurrences = sorted(date_set(d.auto_paid_occurrences) | {iso})
        db.add(d)
        tx = tx_by_id[lite.id]
        tx.linked_deadline_id = d.id
        tx.linked_occurrence = row.date
        db.add(tx)
        logger.info("auto-tick: %s %s ← tx %s (%.2f on %s)", d.title, iso, tx.id, lite.amount, lite.date)
    await db.commit()
    return pairs


def record_untick(d: Deadline, iso: str) -> None:
    """The user unticked `iso`: if it was an auto-tick, never auto-tick it again."""
    auto = date_set(d.auto_paid_occurrences)
    if iso in auto:
        d.auto_paid_occurrences = sorted(auto - {iso})
        d.auto_rejected_occurrences = sorted(date_set(d.auto_rejected_occurrences) | {iso})
