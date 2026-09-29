"""Deadline ledger — the backend twin of the Scadenze view.

`paid_occurrences` dates are written by the frontend (scadenzeService
expandDeadline), so everything that reasons about "is this rata/charge paid?"
must reproduce THAT expansion date-for-date — not /deadlines/occurrences, which
steps installments by recurrence_interval and starts subscriptions from today:

  - installments: rata #paid+1+i on due_date + i months (always monthly)
  - subscriptions: from due_date, one interval at a time, day clamped each step
    (Jan 31 → Feb 28 → Mar 28, same as the frontend's addMonths loop)
  - one-off: due_date; settled plans collapse to one paid row at due_date

Pure functions only (no DB): the dashboard totals, the "prossimi pagamenti"
timeline, the end-of-month forecast and the bank auto-tick all build on them.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Optional

from dateutil.relativedelta import relativedelta

INTERVAL_STEP = {"monthly": 1, "quarterly": 3, "yearly": 12}
SUBSCRIPTION_HORIZON_MONTHS = 12   # frontend SUBSCRIPTION_HORIZON_MONTHS
_GUARD = 1200


def _v(x) -> str:
    return str(getattr(x, "value", x) or "").lower()


def date_set(raw) -> set[str]:
    """ISO dates from a JSON column — tolerant of NULL / JSON null / non-lists."""
    return {str(x) for x in raw} if isinstance(raw, list) else set()


def _amount(d) -> Optional[float]:
    return float(d.amount) if d.amount is not None else None


@dataclass
class Row:
    """One dated line of a deadline, as the Scadenze view shows it."""

    deadline: Any
    date: date
    amount: Optional[float]
    paid: bool
    auto: bool = False          # ticked by the bank matcher, not by hand
    occurrence: bool = False    # a rata / subscription charge (ticked per date)
    index: Optional[int] = None
    total: Optional[int] = None

    @property
    def key(self) -> str:
        return f"{self.deadline.id}@{self.date.isoformat()}"


def ui_rows(d, today: date) -> list[Row]:
    """Exactly the rows scadenzeService.expandDeadline renders for `d`."""
    amount = _amount(d)
    paid_set = date_set(d.paid_occurrences)
    auto_set = date_set(getattr(d, "auto_paid_occurrences", None))
    rtype = _v(d.recurrence_type) or "none"
    total = d.installments_total or 0
    paid_n = max(0, d.installments_paid or 0)
    settled = bool(d.is_completed) or (rtype == "installments" and total > 0 and paid_n >= total)
    single = Row(d, d.due_date, amount, paid=settled, auto=d.due_date.isoformat() in auto_set)
    if d.is_completed:
        return [single]

    if rtype == "installments":
        if total <= 0:
            return [single]
        out = []
        for i in range(total - paid_n):
            when = d.due_date + relativedelta(months=i)
            iso = when.isoformat()
            out.append(Row(d, when, amount, paid=iso in paid_set, auto=iso in auto_set,
                           occurrence=True, index=paid_n + 1 + i, total=total))
        return out or [single]

    if rtype == "subscription":
        step = INTERVAL_STEP.get(_v(d.recurrence_interval) or "monthly", 1)
        month_start = today.replace(day=1)
        horizon = today + relativedelta(months=SUBSCRIPTION_HORIZON_MONTHS)
        out, when, guard = [], d.due_date, 0
        while when < month_start and guard < _GUARD:
            iso = when.isoformat()
            if iso in paid_set:  # past charges survive only if ticked (Storico)
                out.append(Row(d, when, amount, paid=True, auto=iso in auto_set, occurrence=True))
            when = when + relativedelta(months=step)
            guard += 1
        while when <= horizon and guard < _GUARD:
            iso = when.isoformat()
            out.append(Row(d, when, amount, paid=iso in paid_set, auto=iso in auto_set, occurrence=True))
            when = when + relativedelta(months=step)
            guard += 1
        return out or [single]

    return [single]


def occurrences_between(d, start: date, end: date) -> list[Row]:
    """Every occurrence of `d` dated in [start, end], paid or not — including
    past subscription charges the view hides until they're ticked. Used by the
    matcher, which may tick a past charge into the Storico."""
    if d.is_completed:
        return []
    amount = _amount(d)
    paid_set = date_set(d.paid_occurrences)
    auto_set = date_set(getattr(d, "auto_paid_occurrences", None))
    rtype = _v(d.recurrence_type) or "none"

    if rtype == "installments":
        total = d.installments_total or 0
        paid_n = max(0, d.installments_paid or 0)
        out = []
        for i in range(max(0, total - paid_n)):
            when = d.due_date + relativedelta(months=i)
            if start <= when <= end:
                iso = when.isoformat()
                out.append(Row(d, when, amount, paid=iso in paid_set, auto=iso in auto_set,
                               occurrence=True, index=paid_n + 1 + i, total=total))
        return out

    if rtype == "subscription":
        step = INTERVAL_STEP.get(_v(d.recurrence_interval) or "monthly", 1)
        out, when, guard = [], d.due_date, 0
        while when <= end and guard < _GUARD:
            if when >= start:
                iso = when.isoformat()
                out.append(Row(d, when, amount, paid=iso in paid_set, auto=iso in auto_set, occurrence=True))
            when = when + relativedelta(months=step)
            guard += 1
        return out

    if start <= d.due_date <= end:
        return [Row(d, d.due_date, amount, paid=False,
                    auto=d.due_date.isoformat() in auto_set)]
    return []


# ─── Aggregates ──────────────────────────────────────────────────────────────

@dataclass
class Totals:
    total: float = 0.0
    paid: float = 0.0

    @property
    def remaining(self) -> float:
        return round(self.total - self.paid, 2)


def totals(rows: Iterable[Row]) -> Totals:
    """Money totals over rows that carry an amount (same rule as the month header)."""
    t = Totals()
    for r in rows:
        if r.amount is None:
            continue
        t.total += r.amount
        if r.paid:
            t.paid += r.amount
    t.total, t.paid = round(t.total, 2), round(t.paid, 2)
    return t


def rows_for(deadlines: Iterable, today: date) -> list[Row]:
    return [r for d in deadlines for r in ui_rows(d, today)]


def in_range(rows: Iterable[Row], start: date, end: date) -> list[Row]:
    return [r for r in rows if start <= r.date <= end]


# ─── Bank auto-tick matcher ─────────────────────────────────────────────────

# Words that never identify a payee in a deadline title.
_STOP = {
    "abbonamento", "rata", "rate", "prestito", "one", "time", "the", "per", "con",
    "pagamento", "mensile", "annuale", "gennaio", "febbraio", "marzo", "aprile",
    "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
}
# How a payee shows up on the bank statement when it differs from its name
# (checked against the real Revolut feed): App Store subscriptions bill as
# "apple.com/bill", Scalapay plans funded through PayPal bill as "Paypal *paga
# in 3 rate", the Metal plan fee as "Metal repricing".
_ALIASES: dict[str, tuple[str, ...]] = {
    "icloud": ("apple.com/bill",),
    "apple": ("apple.com/bill",),
    "grindr": ("grindr", "apple.com/bill"),
    "hingex": ("hinge", "apple.com/bill"),
    "anthropic": ("anthropic", "claude"),
    "amazon": ("amazon", "amzn"),
    "scalapay": ("scalapay", "paypal"),
    "revolut": ("revolut", "metal"),
}
AMOUNT_TOLERANCE = 0.02   # € — BNPL amounts cluster (14,43 / 14,45 / 15,65): no % tolerance
# Hand-entered due dates drift from the real charge by up to ~2 weeks (seen:
# 9–13 days on Scalapay plans). Monthly occurrences are ≥28 days apart, and the
# nearest-date ranking keeps each charge on its own month.
DATE_WINDOW_DAYS = 14


def match_terms(title: str) -> tuple[set[str], set[str]]:
    """(payee terms, detail words) of a deadline title.

    "Klarna - gearup" → ({"klarna"}, {"gearup"}): the payee must appear on the
    statement; a detail word hit only breaks ties between candidates.
    """
    words = [w for w in re.findall(r"[a-z0-9]+", (title or "").lower()) if len(w) >= 3 and w not in _STOP]
    if not words:
        return set(), set()
    primary = words[0]
    return {primary, *_ALIASES.get(primary, ())}, set(words[1:])


@dataclass
class TxLite:
    id: Any
    date: date
    amount: float
    text: str   # "<description> <merchant>" lowercased


def propose_matches(
    rows: Iterable[Row],
    txs: Iterable[TxLite],
    *,
    rejected: set[str] = frozenset(),
    tolerance: float = AMOUNT_TOLERANCE,
    window_days: int = DATE_WINDOW_DAYS,
) -> list[tuple[Row, TxLite]]:
    """One-to-one (occurrence, transaction) pairs for UNPAID occurrences.

    Already-paid occurrences take part in the assignment too, so the charge
    that paid a hand-ticked rata is "spent" on it and can't tick a sibling plan
    of the same amount (two PayPal plans of €36,45 a day apart); their pairs
    are just not returned.

    A pair needs: unpaid occurrence with an amount, not rejected by the user;
    the payee (or a known alias) on the statement; |Δamount| ≤ tolerance;
    |Δdate| ≤ window.
    Ranking: detail-word hit, then closer date, then closer amount — so two
    PayPal plans of €36,45 each take the charge nearest their own date.
    """
    txs = list(txs)
    cands = []
    for r in rows:
        if r.amount is None or r.key in rejected:
            continue
        payee, details = match_terms(r.deadline.title)
        if not payee:
            continue
        for t in txs:
            da = abs(t.amount - r.amount)
            if da > tolerance + 1e-9:
                continue
            dd = abs((t.date - r.date).days)
            # Also match with spaces/punctuation stripped: "real credito" ↔ "RealCredito".
            compact = re.sub(r"[^a-z0-9]", "", t.text)
            if dd > window_days or not any(p in t.text or p in compact for p in payee):
                continue
            detail_hit = any(w in t.text or w in compact for w in details)
            cands.append(((0 if detail_hit else 1, dd, da), r, t))
    cands.sort(key=lambda c: c[0])
    used_rows, used_txs, out = set(), set(), []
    for _, r, t in cands:
        if r.key in used_rows or t.id in used_txs:
            continue
        used_rows.add(r.key)
        used_txs.add(t.id)
        if not r.paid:
            out.append((r, t))
    return out
