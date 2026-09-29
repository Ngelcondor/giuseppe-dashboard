"""Finance flows against a real Postgres (embedded via `pgserver`).

Covers what pure tests can't: JSON/enum/UUID columns, the prod schema upgrade
(_sync_missing_columns adding the new nullable columns), bank sync de-dup,
auto-tick writes, CSV import, the dashboard and the nightly job.

Skipped when pgserver isn't installed (`pip install pgserver`; Python ≤ 3.12).
"""
import asyncio
import io
import tempfile
import uuid
from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest

pgserver = pytest.importorskip("pgserver")

from fastapi import UploadFile  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.future import select  # noqa: E402

import app.models  # noqa: E402,F401 — register every table on Base.metadata
from app.api.v1.endpoints import budget as budget_ep  # noqa: E402
from app.api.v1.endpoints import deadlines as deadlines_ep  # noqa: E402
from app.core.database import Base, _sync_missing_columns  # noqa: E402
from app.models.budget import (  # noqa: E402
    BankAccount, BankConnection, BankConnectionStatus, BudgetGoal, Transaction,
    TransactionSource, TransactionType,
)
from app.models.deadline import Deadline, RecurrenceInterval, RecurrenceType  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User  # noqa: E402
from app.schemas.budget import BankAuthCallbackRequest, CategoryLimitSet  # noqa: E402
from app.schemas.deadline import DeadlineOccurrencePaidRequest  # noqa: E402
from app.services import bank_sync_service as svc  # noqa: E402
from app.services.bank_provider import (  # noqa: E402
    BankAccountInfo, BankBalance, BankSessionExpired, BankTransaction, BankTransactionList,
)


@pytest.fixture(scope="module")
def pg_url():
    srv = pgserver.get_server(tempfile.mkdtemp(prefix="pgt", dir="/tmp"), cleanup_mode="stop")
    uri = srv.get_uri()  # postgresql://postgres:@/postgres?host=/tmp/...
    yield uri.replace("postgresql://", "postgresql+asyncpg://", 1)


def run(pg_url, scenario):
    """Fresh schema per test; `scenario(db, user)` runs in its own loop."""
    async def _main():
        engine = create_async_engine(pg_url)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.execute(text("DROP TYPE IF EXISTS recurrencetype, recurrenceinterval, "
                                    "deadlinecategory, deadlinepriority, transactiontype, "
                                    "recurringfrequency CASCADE"))
            await conn.run_sync(Base.metadata.create_all)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            user = User(email=f"{uuid.uuid4().hex}@x.io", username=uuid.uuid4().hex, hashed_password="x")
            db.add(user)
            await db.commit()
            # Plain id holder: endpoints may roll the shared session back, which
            # expires ORM objects (re-reading them would be implicit async IO).
            owner = SimpleNamespace(id=user.id)
            try:
                return await scenario(db, owner)
            finally:
                await engine.dispose()
    return asyncio.run(_main())


# ─── fakes ───────────────────────────────────────────────────────────────────

class FakeProvider:
    provider_name = "Fake"

    def __init__(self, txs=None, balances=None, expired=False, accounts=None):
        self.txs, self.balances, self.expired = txs or {}, balances or {}, expired
        self.accounts = accounts or []

    async def get_transactions(self, uid, date_from=None, date_to=None):
        if self.expired:
            raise BankSessionExpired("gone")
        return BankTransactionList(booked=list(self.txs.get(uid, [])))

    async def get_balances(self, uid):
        if self.expired:
            raise BankSessionExpired("gone")
        return [BankBalance(self.balances.get(uid, 0.0), "EUR", "ITAV")]

    async def complete_auth(self, token):
        return self.accounts


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, k):
        return self.store.get(k)

    async def setex(self, k, ttl, v):
        self.store[k] = v


def btx(tid, amount, day, desc):
    return BankTransaction(transaction_id=tid, amount=amount, booking_date=date.fromisoformat(day), description=desc)


async def add_conn(db, user, **kw):
    conn = BankConnection(
        user_id=user.id, institution_id="Revolut", institution_name="Revolut",
        status=kw.pop("status", BankConnectionStatus.ACTIVE), account_id=kw.pop("account_id", "acc-eur"),
        currency="EUR", expires_at=kw.pop("expires_at", datetime.utcnow() + timedelta(days=100)), **kw,
    )
    db.add(conn)
    await db.commit()
    return conn


# ─── schema upgrade (prod path) ──────────────────────────────────────────────

def test_sync_missing_columns_adds_the_new_nullable_columns(pg_url):
    new_cols = {
        "transactions": ("linked_deadline_id", "linked_occurrence"),
        "deadlines": ("auto_paid_occurrences", "auto_rejected_occurrences"),
        "bank_connections": ("session_id",),
    }

    async def scenario(db, user):
        for table, cols in new_cols.items():
            for c in cols:
                await db.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{c}"'))
        await db.execute(text('DROP TABLE "bank_accounts"'))
        await db.commit()
        conn = await db.connection()
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        await conn.run_sync(_sync_missing_columns)
        await db.commit()
        found = {}
        for table in [*new_cols, "bank_accounts"]:
            rows = await db.execute(text(
                "select column_name from information_schema.columns where table_name=:t"), {"t": table})
            found[table] = {r[0] for r in rows}
        return found

    found = run(pg_url, scenario)
    for table, cols in new_cols.items():
        assert set(cols) <= found[table], table
    assert {"account_uid", "sync_enabled", "is_primary"} <= found["bank_accounts"]


# ─── bank callback + sync ────────────────────────────────────────────────────

def test_callback_stores_every_account_and_primary_eur(pg_url, monkeypatch):
    until = datetime(2027, 3, 28, 9, 30)
    accounts = [
        BankAccountInfo("acc-usd", iban="LT1", name="USD", currency="USD", valid_until=until, session_id="s-1"),
        BankAccountInfo("acc-eur", iban="LT00000000001234", name="EUR", currency="EUR", valid_until=until, session_id="s-1"),
    ]
    monkeypatch.setattr(budget_ep, "get_bank_provider", lambda: FakeProvider(accounts=accounts))

    async def scenario(db, user):
        old = await add_conn(db, user)
        pending = await add_conn(db, user, status=BankConnectionStatus.PENDING, account_id=None, expires_at=None)
        await budget_ep.bank_auth_callback(BankAuthCallbackRequest(code="c"), current_user={"sub": user.id}, db=db)
        await db.refresh(old)
        await db.refresh(pending)
        rows = (await db.execute(select(BankAccount).where(BankAccount.connection_id == pending.id))).scalars().all()
        return old, pending, rows

    old, conn, rows = run(pg_url, scenario)
    assert old.status == BankConnectionStatus.EXPIRED and old.last_sync_error == svc.SUPERSEDED_MSG
    assert conn.status == BankConnectionStatus.ACTIVE and conn.account_id == "acc-eur"
    assert conn.session_id == "s-1" and conn.expires_at == until
    by_uid = {r.account_uid: r for r in rows}
    assert by_uid["acc-eur"].is_primary and by_uid["acc-eur"].sync_enabled
    assert not by_uid["acc-usd"].is_primary and not by_uid["acc-usd"].sync_enabled


def test_sync_dedups_ids_reconnect_content_and_csv_rows(pg_url):
    today = date.today()
    d1, d2, d3 = (today - timedelta(days=n) for n in (3, 2, 1))

    async def scenario(db, user):
        old = await add_conn(db, user, status=BankConnectionStatus.EXPIRED)
        # imported by the OLD connection with its own ids
        db.add(Transaction(user_id=user.id, amount=12.5, category="Varie", description="Bar Pepe",
                           transaction_type=TransactionType.EXPENSE, date=d1, source=TransactionSource.BANK_SYNC,
                           external_id="old-1", bank_connection_id=old.id))
        # imported from a CSV, described differently
        db.add(Transaction(user_id=user.id, amount=266.0, category="Casa", description="To Sh Barcelona",
                           transaction_type=TransactionType.EXPENSE, date=d2, source=TransactionSource.CSV_IMPORT,
                           external_id="csv_x"))
        await db.commit()
        conn = await add_conn(db, user)
        provider = FakeProvider(txs={"acc-eur": [
            btx("new-1", -12.5, d1.isoformat(), "Bar Pepe"),               # re-keyed by the bank → content dup
            btx("new-2", -266.0, d2.isoformat(), "Alquiler abril"),         # same payment as the CSV row
            btx("new-3", -3.2, d3.isoformat(), "Mercadona"),                # genuinely new
            btx("new-3", -3.2, d3.isoformat(), "Mercadona"),                # intra-batch duplicate
        ]})
        first = await svc.sync_connection(db, conn, provider, days_back=30)
        second = await svc.sync_connection(db, conn, provider, days_back=30)
        count = len((await db.execute(select(Transaction).where(Transaction.user_id == user.id))).scalars().all())
        return first, second, count

    first, second, count = run(pg_url, scenario)
    assert (first.imported, first.skipped) == (1, 3)
    assert (second.imported, second.skipped) == (0, 4)
    assert count == 3


def test_sync_endpoint_expires_on_dead_session(pg_url, monkeypatch):
    monkeypatch.setattr(budget_ep, "get_bank_provider", lambda: FakeProvider(expired=True))

    async def scenario(db, user):
        conn = await add_conn(db, user)
        with pytest.raises(Exception) as err:
            await budget_ep.sync_bank_transactions(days_back=30, current_user={"sub": user.id}, db=db)
        await db.refresh(conn)
        notes = (await db.execute(select(Notification).where(Notification.user_id == user.id))).scalars().all()
        return err.value, conn, notes

    err, conn, notes = run(pg_url, scenario)
    assert getattr(err, "status_code", None) == 409
    assert conn.status == BankConnectionStatus.EXPIRED and conn.last_sync_error == svc.SESSION_REVOKED_MSG
    assert len(notes) == 1 and notes[0].link == "/dashboard/budget"


# ─── auto-tick ───────────────────────────────────────────────────────────────

def test_auto_tick_links_once_and_respects_user_untick(pg_url):
    from app.services.auto_tick_service import apply_auto_ticks
    today = date.today()
    due = today - timedelta(days=5)

    async def scenario(db, user):
        plan = Deadline(user_id=user.id, title="Klarna - gearup", due_date=due, amount=19.95,
                        recurrence_type=RecurrenceType.INSTALLMENTS, installments_total=3, installments_paid=0,
                        paid_occurrences=None)
        db.add(plan)
        for i, day in enumerate((due - timedelta(days=1), due + timedelta(days=2))):
            db.add(Transaction(user_id=user.id, amount=19.95, category="Rate", description="Klarna*gearup Booste",
                               transaction_type=TransactionType.EXPENSE, date=day,
                               source=TransactionSource.BANK_SYNC, external_id=f"k{i}"))
        await db.commit()

        first = await apply_auto_ticks(db, user.id, today=today)
        await db.refresh(plan)
        after_first = (list(plan.paid_occurrences), list(plan.auto_paid_occurrences))
        linked = (await db.execute(select(Transaction).where(Transaction.linked_deadline_id == plan.id))).scalars().all()

        # the user unticks the auto-tick → rejected, never re-ticked by the other charge
        await deadlines_ep.set_occurrence_paid(
            str(plan.id), DeadlineOccurrencePaidRequest(date=due, paid=False), current_user={"sub": user.id}, db=db)
        again = await apply_auto_ticks(db, user.id, today=today)
        await db.refresh(plan)
        return first, after_first, linked, again, plan

    first, (paid, auto), linked, again, plan = run(pg_url, scenario)
    assert len(first) == 1 and paid == [due.isoformat()] and auto == [due.isoformat()]
    assert len(linked) == 1 and linked[0].linked_occurrence == due
    assert again == []
    assert plan.paid_occurrences == [] and plan.auto_rejected_occurrences == [due.isoformat()]


def test_auto_tick_completes_a_one_off_payment(pg_url):
    from app.services.auto_tick_service import apply_auto_ticks
    today = date.today()

    async def scenario(db, user):
        loan = Deadline(user_id=user.id, title="RealCredito", due_date=today - timedelta(days=1), amount=112)
        db.add(loan)
        db.add(Transaction(user_id=user.id, amount=112.0, category="Rate", description="Real Credito",
                           transaction_type=TransactionType.EXPENSE, date=today - timedelta(days=2),
                           source=TransactionSource.BANK_SYNC, external_id="rc"))
        await db.commit()
        await apply_auto_ticks(db, user.id, today=today)
        await db.refresh(loan)
        return loan

    loan = run(pg_url, scenario)
    assert loan.is_completed and loan.auto_paid_occurrences == [(today - timedelta(days=1)).isoformat()]


# ─── CSV import ──────────────────────────────────────────────────────────────

CSV = """Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-04-02 10:00:00,2026-04-02 10:00:01,Cafe Tomate,-1.50,0.00,EUR,COMPLETED,100
CARD_PAYMENT,Current,2026-04-02 11:00:00,2026-04-02 11:00:01,Cafe Tomate,-1.50,0.00,EUR,COMPLETED,98.5
TRANSFER,Current,2026-04-02 12:00:00,2026-04-02 12:00:01,To Sh Barcelona,-266.00,0.00,EUR,COMPLETED,-167.5
"""


def test_csv_import_survives_identical_rows_and_skips_bank_rows(pg_url):
    async def scenario(db, user):
        db.add(Transaction(user_id=user.id, amount=266.0, category="Casa", description="Alquiler abril",
                           transaction_type=TransactionType.EXPENSE, date=date(2026, 4, 2),
                           source=TransactionSource.BANK_SYNC, external_id="eb-rent"))
        await db.commit()

        def upload():
            return UploadFile(file=io.BytesIO(CSV.encode()), filename="rev.csv")
        first = await budget_ep.import_csv(file=upload(), current_user={"sub": user.id}, db=db)
        second = await budget_ep.import_csv(file=upload(), current_user={"sub": user.id}, db=db)
        n = len((await db.execute(select(Transaction).where(Transaction.user_id == user.id))).scalars().all())
        return first, second, n

    first, second, n = run(pg_url, scenario)
    assert (first.imported, first.skipped) == (2, 1)
    assert (second.imported, second.skipped) == (0, 3)
    assert n == 3


# ─── dashboard ───────────────────────────────────────────────────────────────

def test_dashboard_scadenze_forecast_limits_and_accounts(pg_url, monkeypatch):
    today = date.today()
    ms = today.replace(day=1)
    provider = FakeProvider(balances={"acc-eur": 1000.0, "acc-usd": 50.0})
    monkeypatch.setattr(budget_ep, "get_bank_provider", lambda: provider)
    fake_redis = FakeRedis()

    async def fake_client():
        return fake_redis
    monkeypatch.setattr("app.services.bank_balance_cache._default_client", fake_client)

    async def scenario(db, user):
        conn = await add_conn(db, user)
        db.add(BankAccount(connection_id=conn.id, user_id=user.id, account_uid="acc-eur", currency="EUR",
                           iban="LT00000000001234", is_primary=True, sync_enabled=True))
        db.add(BankAccount(connection_id=conn.id, user_id=user.id, account_uid="acc-usd", currency="USD",
                           is_primary=False, sync_enabled=False))
        db.add(Deadline(user_id=user.id, title="Affitto", due_date=ms, amount=700,
                        recurrence_type=RecurrenceType.SUBSCRIPTION, recurrence_interval=RecurrenceInterval.MONTHLY,
                        paid_occurrences=[ms.isoformat()]))
        db.add(Deadline(user_id=user.id, title="Klarna - CK", due_date=ms + timedelta(days=1), amount=51.30,
                        recurrence_type=RecurrenceType.INSTALLMENTS, installments_total=3, paid_occurrences="null"))
        # limit set two months ago carries forward; a later 0 removes another
        two_ago = (ms - timedelta(days=40)).replace(day=1)
        db.add(BudgetGoal(user_id=user.id, category="Alimentari", monthly_limit=300, month=two_ago))
        db.add(BudgetGoal(user_id=user.id, category="Svago", monthly_limit=80, month=two_ago))
        db.add(BudgetGoal(user_id=user.id, category="Svago", monthly_limit=0, month=ms))
        db.add(Transaction(user_id=user.id, amount=120.0, category="Alimentari", description="Mercadona",
                           transaction_type=TransactionType.EXPENSE, date=today, source=TransactionSource.MANUAL))
        await db.commit()
        dash = await budget_ep.get_budget_dashboard(month=today.month, year=today.year, view_user_id=user.id, db=db)
        # a second load inside the freshness window must not call the bank again
        calls_before = len(fake_redis.store)
        provider.balances["acc-eur"] = 5.0
        dash2 = await budget_ep.get_budget_dashboard(month=today.month, year=today.year, view_user_id=user.id, db=db)
        return dash, dash2, calls_before

    dash, dash2, _ = run(pg_url, scenario)
    assert dash.bank_connected and dash.bank_balance == 1000.0          # USD account excluded
    assert [(a.currency, a.balance, a.iban_tail) for a in dash.bank_accounts] == [("EUR", 1000.0, "1234"), ("USD", 50.0, None)]
    assert dash2.bank_balance == 1000.0                                  # served from cache
    assert (dash.scadenze_total, dash.scadenze_paid) == (751.3, 700.0)
    assert dash.forecast_due == 51.3 and dash.forecast_balance == 948.7
    cats = {c.category: c for c in dash.categories}
    assert cats["Alimentari"].limit == 300 and cats["Alimentari"].remaining == 180
    assert "Svago" not in cats
    assert [s.desc for s in dash.upcoming_scadenze + dash.overdue_scadenze if "Klarna" in s.desc]


def test_set_category_limit_upserts_per_month(pg_url):
    async def scenario(db, user):
        body = CategoryLimitSet(category="Alimentari", monthly_limit=250, month=date(2026, 9, 17))
        await budget_ep.set_category_limit(body, current_user={"sub": user.id}, db=db)
        await budget_ep.set_category_limit(CategoryLimitSet(category="Alimentari", monthly_limit=None, month=date(2026, 9, 1)),
                                           current_user={"sub": user.id}, db=db)
        return (await db.execute(select(BudgetGoal).where(BudgetGoal.user_id == user.id))).scalars().all()

    goals = run(pg_url, scenario)
    assert len(goals) == 1 and goals[0].month == date(2026, 9, 1) and goals[0].monthly_limit == 0


# ─── nightly job ─────────────────────────────────────────────────────────────

def test_nightly_warns_syncs_and_expires(pg_url):
    today = date.today()

    async def scenario(db, user):
        warn = await add_conn(db, user, expires_at=datetime.combine(today + timedelta(days=7), datetime.min.time()) + timedelta(hours=5))
        lapsed = await add_conn(db, user, expires_at=datetime.utcnow() - timedelta(hours=1), account_id="acc-2")
        provider = FakeProvider(txs={"acc-eur": [btx("n1", -9.99, today.isoformat(), "apple.com/bill")]})
        report = await svc.run_nightly(db, provider, client=FakeRedis(), today=today)
        await db.refresh(warn)
        await db.refresh(lapsed)
        notes = (await db.execute(select(Notification).where(Notification.user_id == user.id))).scalars().all()
        return report, warn, lapsed, notes

    report, warn, lapsed, notes = run(pg_url, scenario)
    assert report["synced"] == 1 and report["imported"] == 1 and report["warned"] == 1 and report["expired"] == 1
    assert warn.last_sync_at is not None and lapsed.status == BankConnectionStatus.EXPIRED
    assert sorted(n.title[:3] for n in notes) == ["🏦 C", "🏦 R"]
