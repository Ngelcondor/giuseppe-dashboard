"""Categorisation on real statement strings, CSV parsing, balance cache."""
import asyncio
from datetime import datetime, timedelta

import pytest

from app.services import bank_balance_cache as cache
from app.services.bank_provider import BankBalance, BankSessionExpired
from app.services.category_service import categorize, subscription_keywords
from app.services.csv_import_service import parse_revolut_csv


# ─── categorisation ──────────────────────────────────────────────────────────

SUBS = subscription_keywords(["Klarna", "Hetzner", "Spotify", "Amazon Prime", "iCloud+"])


@pytest.mark.parametrize("desc, amount", [
    ("Cofidis Amazon", 19.36),
    ("Scalapay* Amazon", 14.43),
    ("Klarna*palau De La M", 24.21),
    ("Klarna*hetzner", 7.79),
    ("Klarna*gearup Booste", 19.95),
])
def test_named_bnpl_lenders_are_rate_whatever_the_merchant(desc, amount):
    assert categorize(description=desc, merchant=desc, sub_keywords=SUBS, amount=amount) == "Rate"


def test_subscription_named_after_a_lender_yields_no_keyword():
    assert "klarna" not in SUBS
    assert "hetzner" in SUBS and "spotify" in SUBS


def test_real_subscriptions_still_categorised():
    assert categorize(description="Spotifyes", merchant="Spotifyes", sub_keywords=SUBS, amount=6.49) == "Abbonamenti"
    assert categorize(description="Hetzner Online", merchant="Hetzner Online", sub_keywords=SUBS, amount=51.89) == "Abbonamenti"


def test_ambiguous_short_lender_names_do_not_win_early():
    # "pagos" contains "agos": must not be forced into Rate before keyword rules
    assert categorize(description="Mercadona pagos", merchant="Mercadona", amount=30) == "Alimentari"


def test_paypal_without_merchant_is_still_rate():
    assert categorize(description="Paypal *paga In 3 Rate", merchant="Paypal *paga In 3 Rate", amount=22) == "Rate"


# ─── CSV import ──────────────────────────────────────────────────────────────

CSV = """Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-04-02 10:00:00,2026-04-02 10:00:01,Cafe Tomate,-1.50,0.00,EUR,COMPLETED,100
CARD_PAYMENT,Current,2026-04-02 11:00:00,2026-04-02 11:00:01,Cafe Tomate,-1.50,0.00,EUR,COMPLETED,98.5
CARD_PAYMENT,Current,2026-04-02 12:00:00,2026-04-02 12:00:01,Cafe Tomate,-1.50,0.00,EUR,COMPLETED,97
CARD_PAYMENT,Current,2026-04-03 12:00:00,2026-04-03 12:00:01,Mercadona,-20.00,0.00,EUR,COMPLETED,77
"""


def test_identical_rows_in_one_file_get_stable_unique_ids():
    rows = parse_revolut_csv(CSV, user_id="u")
    ids = [r["external_id"] for r in rows]
    assert len(ids) == len(set(ids)) == 4
    assert ids[1] == ids[0] + "#2" and ids[2] == ids[0] + "#3"
    assert [r["external_id"] for r in parse_revolut_csv(CSV, user_id="u")] == ids   # re-import dedups


# ─── balance cache ───────────────────────────────────────────────────────────

class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, k):
        return self.store.get(k)

    async def setex(self, k, ttl, v):
        self.store[k] = v


class FakeProvider:
    def __init__(self, result):
        self.result, self.calls = result, 0

    async def get_balances(self, uid):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _run(c):
    return asyncio.run(c)


NOW = datetime(2026, 9, 29, 8, 0)


def test_fresh_cache_skips_the_bank():
    r, p = FakeRedis(), FakeProvider([BankBalance(100.0, "EUR", "ITAV")])
    first = _run(cache.get_balance(p, "acc", client=r, now=NOW))
    again = _run(cache.get_balance(p, "acc", client=r, now=NOW + timedelta(hours=5)))
    assert (first.amount, again.amount, p.calls) == (100.0, 100.0, 1)


def test_expired_cache_refetches_and_force_always_does():
    r, p = FakeRedis(), FakeProvider([BankBalance(100.0, "EUR", "ITAV")])
    _run(cache.get_balance(p, "acc", client=r, now=NOW))
    _run(cache.get_balance(p, "acc", client=r, now=NOW + timedelta(hours=7)))
    _run(cache.get_balance(p, "acc", client=r, now=NOW + timedelta(hours=7, minutes=1), force=True))
    assert p.calls == 3


def test_failure_serves_last_known_as_stale():
    r = FakeRedis()
    _run(cache.get_balance(FakeProvider([BankBalance(55.5, "EUR", "CLBD")]), "acc", client=r, now=NOW))
    got = _run(cache.get_balance(FakeProvider(RuntimeError("429")), "acc", client=r, now=NOW + timedelta(hours=8)))
    assert got.amount == 55.5 and got.stale and got.at == NOW


def test_session_expired_always_propagates():
    r = FakeRedis()
    _run(cache.get_balance(FakeProvider([BankBalance(1.0, "EUR", "ITAV")]), "acc", client=r, now=NOW))
    with pytest.raises(BankSessionExpired):
        _run(cache.get_balance(FakeProvider(BankSessionExpired("x")), "acc", client=r, now=NOW, force=True))


def test_preferred_balance_type_wins():
    chosen = cache.pick_balance([BankBalance(1.0, "EUR", "XXXX"), BankBalance(2.0, "EUR", "ITAV")])
    assert chosen.amount == 2.0
