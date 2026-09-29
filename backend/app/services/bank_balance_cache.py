"""Bank balance cache (Redis).

Every server-side call to the bank counts as *unattended* access for PSD2 (we
send no PSU headers), which banks cap at ~4/day per account. The dashboard used
to hit /balances on every load and every month switch; now it reads this cache
and only goes to the bank when the cached value is older than FRESH_FOR.

On a failed fetch the last known balance is served with its timestamp, so the
card shows "saldo al 08:10" instead of "€ —". A manual sync (user present) or
the nightly job pass force=True.

Celery tasks run each job in a fresh asyncio loop, while app.core.redis keeps a
module-global pool bound to the loop that created it — so callers outside the
API process must pass their own short-lived `client`.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from app.services.bank_provider import BankBalance, BankProvider, BankSessionExpired

logger = logging.getLogger(__name__)

FRESH_FOR = timedelta(hours=6)          # ≤4 unattended balance calls/day per account
KEEP_FOR = timedelta(days=14)           # last-known fallback lifetime
KEY = "bank:balance:{uid}"

# Berlin Group long names + EB/ISO short codes, most "current" first.
PREFERRED_TYPES = (
    "closingBooked", "expected", "interimAvailable", "interimBooked",
    "openingBooked", "authorised", "forwardAvailable", "information",
    "CLBD", "XPCD", "ITAV", "ITBD", "OPBD", "PRCD", "FWAV",
)


@dataclass
class CachedBalance:
    amount: float
    currency: str
    at: datetime          # naive UTC — when the bank reported it
    stale: bool = False   # served from cache after a failed fetch


def pick_balance(balances: list[BankBalance]) -> Optional[BankBalance]:
    """The most 'current' balance the bank returned (types vary per ASPSP)."""
    chosen = next((b for b in balances if b.balance_type in PREFERRED_TYPES), None)
    return chosen or (balances[0] if balances else None)


async def _default_client():
    from app.core.redis import get_redis
    return await get_redis()


async def _read(client, uid: str) -> Optional[CachedBalance]:
    try:
        raw = await client.get(KEY.format(uid=uid))
        if not raw:
            return None
        v = json.loads(raw)
        return CachedBalance(float(v["amount"]), v.get("currency") or "EUR", datetime.fromisoformat(v["at"]))
    except Exception as e:  # noqa: BLE001 — cache is best effort
        logger.debug("balance cache read failed for %s: %s", uid, e)
        return None


async def _write(client, uid: str, bal: CachedBalance) -> None:
    try:
        await client.setex(
            KEY.format(uid=uid), int(KEEP_FOR.total_seconds()),
            json.dumps({"amount": bal.amount, "currency": bal.currency, "at": bal.at.isoformat()}),
        )
    except Exception as e:  # noqa: BLE001
        logger.debug("balance cache write failed for %s: %s", uid, e)


async def get_balance(
    provider: BankProvider,
    account_uid: str,
    *,
    force: bool = False,
    client=None,
    now: Optional[datetime] = None,
) -> Optional[CachedBalance]:
    """Balance for one account, from cache when fresh, else from the bank.

    BankSessionExpired always propagates (the caller decides whether to expire
    the connection). Any other fetch failure falls back to the last known value
    (stale=True), or None when there is none.
    """
    now = now or datetime.utcnow()
    if client is None:
        try:
            client = await _default_client()
        except Exception:  # noqa: BLE001 — no Redis: behave like a cache miss
            client = None

    cached = await _read(client, account_uid) if client is not None else None
    if cached and not force and now - cached.at < FRESH_FOR:
        return cached

    try:
        chosen = pick_balance(await provider.get_balances(account_uid))
    except BankSessionExpired:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("balance fetch failed for %s: %s", account_uid, e)
        if cached:
            cached.stale = True
            return cached
        return None

    if chosen is None:
        return cached
    fresh = CachedBalance(chosen.amount, chosen.currency or "EUR", now)
    if client is not None:
        await _write(client, account_uid, fresh)
    return fresh
