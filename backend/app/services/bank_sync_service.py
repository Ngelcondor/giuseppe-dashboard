"""Bank connection lifecycle + transaction sync.

Shared by the /budget API (manual "Sincronizza", bank callback) and the nightly
Celery job, so both classify, de-duplicate and expire connections identically.
"""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.budget import (
    BankAccount,
    BankConnection,
    BankConnectionStatus,
    Transaction,
    TransactionSource,
    TransactionType,
)
from app.models.deadline import Deadline, RecurrenceType
from app.services.bank_balance_cache import CachedBalance, get_balance
from app.services.bank_provider import BankAccountInfo, BankProvider, BankSessionExpired
from app.services.category_service import categorize, subscription_keywords

logger = logging.getLogger(__name__)

CONSENT_EXPIRED_MSG = "Consenso PSD2 scaduto — ricollega il conto"
SESSION_REVOKED_MSG = "La banca ha chiuso la sessione (consenso scaduto o revocato) — ricollega il conto"
SUPERSEDED_MSG = "Sostituita da un nuovo collegamento"


# ─── Connection lifecycle ────────────────────────────────────────────────────

async def expire_connection(
    db: AsyncSession, connection: BankConnection, reason: str, *, notify: bool = True,
) -> None:
    """Mark a connection EXPIRED (idempotent) and tell the user once."""
    if connection.status == BankConnectionStatus.EXPIRED:
        return
    connection.status = BankConnectionStatus.EXPIRED
    connection.last_sync_error = reason
    db.add(connection)
    await db.commit()
    logger.info("Bank connection %s expired: %s", connection.id, reason)
    if notify and reason != SUPERSEDED_MSG:
        await notify_user(
            db, connection,
            title=f"🏦 {connection.institution_name or 'Banca'} scollegata",
            message="Il consenso bancario è scaduto: ricollega il conto per riprendere saldo e sincronizzazione.",
            kind="warning",
        )


async def notify_user(db: AsyncSession, connection: BankConnection, *, title: str, message: str, kind: str) -> None:
    """In-app + push notification about a bank connection. Never raises."""
    try:
        from app.services.notification_service import send_notification
        await send_notification(
            db, str(connection.user_id), title, message, kind, icon="🏦", link="/dashboard/budget",
        )
    except Exception as e:  # noqa: BLE001 — a failed notification must not break a sync
        logger.warning("bank notification failed for %s: %s", connection.id, e)
        await db.rollback()


async def active_connection(db: AsyncSession, user_id) -> Optional[BankConnection]:
    """Latest ACTIVE connection for the user, honestly expiring stale consents.

    Il consenso PSD2 ha una scadenza (expires_at): se è passata, la connessione
    viene marcata EXPIRED qui — così l'API non finge un conto collegato che il
    provider rifiuterebbe, e il frontend propone di ricollegarlo.
    """
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == user_id)
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        ).order_by(BankConnection.created_at.desc())
    )
    connection = result.scalars().first()
    if connection and connection.expires_at and connection.expires_at < datetime.utcnow():
        await expire_connection(db, connection, CONSENT_EXPIRED_MSG)
        return None
    return connection


async def latest_connection(db: AsyncSession, user_id) -> Optional[BankConnection]:
    """Most recent non-PENDING connection (active, expired or error) — for status display."""
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == user_id)
            & (BankConnection.status != BankConnectionStatus.PENDING)
        ).order_by(BankConnection.created_at.desc())
    )
    return result.scalars().first()


# ─── Accounts ────────────────────────────────────────────────────────────────

@dataclass
class AccountRef:
    """A connection's account when no BankAccount rows exist (connections made
    before multi-account support carry only their primary account)."""

    account_uid: str
    name: Optional[str]
    iban: Optional[str]
    currency: str
    id: Optional[object] = None
    is_primary: bool = True
    sync_enabled: bool = True


def choose_primary(accounts: list[BankAccountInfo]) -> int:
    """Index of the primary account: the first EUR one, else the first."""
    return next((i for i, a in enumerate(accounts) if (a.currency or "").upper() == "EUR"), 0)


def save_accounts(connection: BankConnection, accounts: list[BankAccountInfo]) -> list[BankAccount]:
    """Persist every account of a fresh consent; only the primary one syncs by default."""
    p = choose_primary(accounts)
    rows = [
        BankAccount(
            connection_id=connection.id,
            user_id=connection.user_id,
            account_uid=a.account_id,
            iban=a.iban,
            name=a.name or "Conto",
            currency=(a.currency or "EUR").upper(),
            is_primary=(i == p),
            sync_enabled=(i == p),
        )
        for i, a in enumerate(accounts)
    ]
    primary = accounts[p]
    connection.account_id = primary.account_id
    connection.account_iban = primary.iban
    connection.account_name = primary.name or "Conto"
    connection.currency = (primary.currency or "EUR").upper()
    connection.session_id = primary.session_id
    return rows


async def connection_accounts(db: AsyncSession, connection: BankConnection) -> list:
    """BankAccount rows of a connection (primary first), or the legacy single account."""
    result = await db.execute(
        select(BankAccount)
        .where(BankAccount.connection_id == connection.id)
        .order_by(BankAccount.is_primary.desc(), BankAccount.created_at)
    )
    rows = list(result.scalars().all())
    if rows:
        return rows
    if connection.account_id:
        return [AccountRef(
            account_uid=connection.account_id, name=connection.account_name,
            iban=connection.account_iban, currency=(connection.currency or "EUR").upper(),
        )]
    return []


async def account_balances(
    db: AsyncSession, connection: BankConnection, provider: BankProvider,
    *, force: bool = False, client=None,
) -> list[tuple[object, Optional[CachedBalance]]]:
    """(account, balance) for every account of the connection, via the cache.

    BankSessionExpired propagates from the first account that reports it.
    """
    out = []
    for acc in await connection_accounts(db, connection):
        out.append((acc, await get_balance(provider, acc.account_uid, force=force, client=client)))
    return out


# ─── Transaction sync ────────────────────────────────────────────────────────

@dataclass
class SyncStats:
    imported: int = 0
    skipped: int = 0
    errors: int = 0
    auto_ticked: int = 0

    def add(self, other: "SyncStats") -> None:
        self.imported += other.imported
        self.skipped += other.skipped
        self.errors += other.errors


async def subscription_keywords_for(db: AsyncSession, user_id) -> set[str]:
    """Match phrases for the user's subscriptions (from the Abbonamenti page)."""
    result = await db.execute(
        select(Deadline.title).where(
            (Deadline.user_id == user_id)
            & (Deadline.recurrence_type == RecurrenceType.SUBSCRIPTION)
        )
    )
    return subscription_keywords([t for (t,) in result.all()])


def _sig(d, amount, ttype, desc) -> tuple:
    return (d, round(float(amount), 2), getattr(ttype, "value", ttype), (desc or "")[:500])


def loose_sig(d, amount, ttype) -> tuple:
    """Cross-source identity (CSV vs bank feed): the descriptions never agree."""
    return (d, round(float(amount), 2), getattr(ttype, "value", ttype))


async def sync_account(
    db: AsyncSession,
    *,
    connection: BankConnection,
    account_uid: str,
    provider: BankProvider,
    days_back: int,
    sub_keywords: set[str],
) -> SyncStats:
    """Import one account's booked transactions of the last `days_back` days.

    Adds rows to the session without committing. Raises BankSessionExpired when
    the bank has closed the session.
    """
    user_id = connection.user_id
    date_from = date.today() - timedelta(days=days_back)
    tx_data = await provider.get_transactions(account_uid, date_from=date_from)
    stats = SyncStats()

    # Dedup in una query sola: con centinaia di transazioni, un SELECT per
    # riga teneva il sync oltre il timeout del client.
    ext_ids = [tx.transaction_id for tx in tx_data.booked if tx.transaction_id]
    seen_ids: set[str] = set()
    if ext_ids:
        existing = await db.execute(
            select(Transaction.external_id).where(
                (Transaction.user_id == user_id) & (Transaction.external_id.in_(ext_ids))
            )
        )
        seen_ids = {row[0] for row in existing.all()}

    # Safety net for reconnects: if the bank issues new transaction ids for the
    # new session, the external_id dedup above misses and the first sync would
    # double 90 days of history. Rows imported by OTHER (older) connections and
    # NOT already matched by id in this batch are matched by content instead —
    # a multiset, so two identical coffees on the same day still map one-to-one.
    # With stable ids every old row matches by id and this set stays empty.
    batch_ids = set(ext_ids)
    prior = await db.execute(
        select(
            Transaction.external_id, Transaction.date, Transaction.amount,
            Transaction.transaction_type, Transaction.description,
        ).where(
            (Transaction.user_id == user_id)
            & (Transaction.source == TransactionSource.BANK_SYNC)
            & (Transaction.date >= date_from)
            & (
                (Transaction.bank_connection_id != connection.id)
                | (Transaction.bank_connection_id.is_(None))
            )
        )
    )
    prior_sigs = Counter(_sig(*row[1:]) for row in prior.all() if row[0] not in batch_ids)

    # Same day+amount+type already imported from a Revolut CSV: the CSV and the
    # bank feed describe the same payment differently ("To Sh Barcelona" vs
    # "Alquiler abril"), so only the loose signature can pair them.
    csv_rows = await db.execute(
        select(Transaction.date, Transaction.amount, Transaction.transaction_type).where(
            (Transaction.user_id == user_id)
            & (Transaction.source == TransactionSource.CSV_IMPORT)
            & (Transaction.date >= date_from)
        )
    )
    csv_sigs = Counter(loose_sig(*row) for row in csv_rows.all())

    for tx in tx_data.booked:
        try:
            ext_id = tx.transaction_id
            if not ext_id:
                stats.errors += 1
                continue
            if not tx.amount:  # skip €0 entries (auth holds, reversals)
                stats.skipped += 1
                continue
            if ext_id in seen_ids:
                stats.skipped += 1
                continue
            seen_ids.add(ext_id)  # dedup anche i duplicati intra-batch

            txn_type = TransactionType.INCOME if tx.amount > 0 else TransactionType.EXPENSE
            description = (tx.description or "N/A")[:500]
            tx_date = tx.booking_date or date.today()

            sig = _sig(tx_date, abs(tx.amount), txn_type, description)
            if prior_sigs[sig] > 0:
                prior_sigs[sig] -= 1
                stats.skipped += 1
                continue
            lsig = loose_sig(tx_date, abs(tx.amount), txn_type)
            if csv_sigs[lsig] > 0:
                csv_sigs[lsig] -= 1
                stats.skipped += 1
                continue

            # Category: MCC first, then merchant/description keyword match.
            mcc = tx.merchant_category_code or ""
            category = categorize(
                description=tx.description,
                merchant=tx.creditor_name or tx.debtor_name,
                mcc=mcc,
                is_income=(txn_type == TransactionType.INCOME),
                sub_keywords=sub_keywords,
                bank_category=tx.bank_transaction_code,
                amount=abs(tx.amount),
            )
            db.add(Transaction(
                user_id=user_id,
                amount=abs(tx.amount),
                category=category,
                description=description,
                transaction_type=txn_type,
                date=tx_date,
                source=TransactionSource.BANK_SYNC,
                external_id=ext_id,
                bank_connection_id=connection.id,
                merchant_name=tx.creditor_name or tx.debtor_name,
                merchant_category_code=mcc,
                bank_category=tx.bank_transaction_code,
                raw_description=str(tx.raw_data)[:2000],
            ))
            stats.imported += 1
        except Exception as e:  # noqa: BLE001 — one bad row never kills the sync
            logger.warning("Error parsing bank transaction: %s", e)
            stats.errors += 1
    return stats


async def sync_connection(
    db: AsyncSession, connection: BankConnection, provider: BankProvider, *, days_back: int,
) -> SyncStats:
    """Sync every sync-enabled account of the connection, then commit.

    BankSessionExpired propagates untouched (nothing has been committed yet);
    the caller decides to expire the connection.
    """
    sub_kws = await subscription_keywords_for(db, connection.user_id)
    stats = SyncStats()
    for acc in await connection_accounts(db, connection):
        if not acc.sync_enabled:
            continue
        stats.add(await sync_account(
            db, connection=connection, account_uid=acc.account_uid,
            provider=provider, days_back=days_back, sub_keywords=sub_kws,
        ))
    connection.last_sync_at = datetime.utcnow()
    connection.last_sync_error = None
    db.add(connection)
    await db.commit()
    stats.auto_ticked = await auto_tick_safely(db, connection.user_id)
    return stats


async def auto_tick_safely(db: AsyncSession, user_id) -> int:
    """Tick Scadenze paid from the new transactions. Never fails the sync."""
    from app.services.auto_tick_service import apply_auto_ticks
    try:
        return len(await apply_auto_ticks(db, user_id))
    except Exception as e:  # noqa: BLE001
        logger.warning("auto-tick failed for user %s: %s", user_id, e)
        await db.rollback()
        return 0


# ─── Nightly job ─────────────────────────────────────────────────────────────

NIGHTLY_DAYS_BACK = 5        # one page of transactions: stays within the PSD2 daily cap
CONSENT_WARN_DAYS = (7, 3, 1)


async def run_nightly(
    db: AsyncSession, provider: Optional[BankProvider], *, client=None, today: Optional[date] = None,
) -> dict:
    """Sync every active connection, refresh balances, warn before consent expiry.

    Returns counters for the task log. Each connection is isolated: one failing
    bank never blocks the others.
    """
    today = today or date.today()
    report = {"synced": 0, "imported": 0, "auto_ticked": 0, "expired": 0, "warned": 0, "failed": 0}
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.status == BankConnectionStatus.ACTIVE)
            & (BankConnection.account_id.isnot(None))
        )
    )
    for conn in result.scalars().all():
        if conn.expires_at and conn.expires_at < datetime.utcnow():
            await expire_connection(db, conn, CONSENT_EXPIRED_MSG)
            report["expired"] += 1
            continue
        if conn.expires_at:
            days_left = (conn.expires_at.date() - today).days
            if days_left in CONSENT_WARN_DAYS:
                await notify_user(
                    db, conn,
                    title=f"🏦 Consenso {conn.institution_name or 'bancario'} in scadenza",
                    message=(
                        f"Scade tra {days_left} {'giorno' if days_left == 1 else 'giorni'}: "
                        "rinnovalo da Finanze per non perdere saldo e sincronizzazione."
                    ),
                    kind="warning",
                )
                report["warned"] += 1
        if provider is None:
            continue
        try:
            stats = await sync_connection(db, conn, provider, days_back=NIGHTLY_DAYS_BACK)
            await account_balances(db, conn, provider, force=True, client=client)
            report["synced"] += 1
            report["imported"] += stats.imported
            report["auto_ticked"] += stats.auto_ticked
        except BankSessionExpired:
            await db.rollback()
            await db.refresh(conn)
            await expire_connection(db, conn, SESSION_REVOKED_MSG)
            report["expired"] += 1
        except Exception as e:  # noqa: BLE001 — isolate per connection
            logger.warning("nightly bank sync failed for %s: %s", conn.id, e)
            await db.rollback()
            await db.refresh(conn)
            conn.last_sync_at = datetime.utcnow()
            conn.last_sync_error = str(e)[:500]
            db.add(conn)
            await db.commit()
            report["failed"] += 1
    return report
