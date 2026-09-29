"""Budget, transaction, bank connection, and CSV import endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import date, datetime, timedelta
from typing import List, Optional
from calendar import monthrange
from collections import Counter

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.core.sections import get_view_user_id
from app.models.budget import (
    Transaction,
    BudgetGoal,
    BankAccount,
    BankConnection,
    BankConnectionStatus,
    TransactionType,
    TransactionSource,
)
from app.models.deadline import Deadline
from app.schemas.budget import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    BudgetGoalCreate,
    BudgetGoalResponse,
    BudgetGoalUpdate,
    BudgetSummary,
    BudgetTrends,
    BudgetDashboard,
    CategorySpending,
    ScadenzaPreview,
    BankConnectionResponse,
    BankAuthInitRequest,
    BankAuthInitResponse,
    BankAuthCallbackRequest,
    BankAccountResponse,
    BankAccountSummary,
    BankAccountUpdate,
    CategoryLimitResponse,
    CategoryLimitSet,
    BankBalanceResponse,
    InstitutionResponse,
    CSVImportResponse,
)
from app.services.bank_factory import get_bank_provider
from app.services.bank_provider import BankSessionExpired
from app.services.bank_sync_service import (
    CONSENT_EXPIRED_MSG,
    SESSION_REVOKED_MSG,
    SUPERSEDED_MSG,
    account_balances,
    active_connection,
    connection_accounts,
    expire_connection,
    latest_connection,
    loose_sig,
    save_accounts,
    subscription_keywords_for,
    sync_connection,
    auto_tick_safely,
)
from app.services.category_service import categorize, TRANSFER_CATEGORY
from app.services.deadline_ledger import in_range, rows_for, totals
from app.services.csv_import_service import parse_revolut_csv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget", tags=["budget"])


# ═══════════════════════════════════════════════════════════════════════════════
#  BANK CONNECTION — GoCardless
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/bank/status")
async def get_bank_status(
    current_user: dict = Depends(get_current_user),
):
    """Check if a bank provider is configured."""
    provider = get_bank_provider()
    return {
        "provider_available": provider is not None,
        "provider_name": provider.provider_name if provider else None,
    }


@router.get("/bank/institutions", response_model=List[InstitutionResponse])
async def list_bank_institutions(
    country: str = Query("FR"),
    current_user: dict = Depends(get_current_user),
) -> List[InstitutionResponse]:
    """List available banking institutions for Open Banking."""
    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato. Usa l'import CSV.")

    try:
        institutions = await provider.list_institutions(country)
        return [
            InstitutionResponse(
                id=inst["id"],
                name=inst["name"],
                logo=inst.get("logo"),
                countries=inst.get("countries"),
            )
            for inst in institutions
        ]
    except Exception as e:
        logger.error(f"Error listing institutions: {e}")
        raise HTTPException(status_code=502, detail=f"Errore {provider.provider_name}: {str(e)}")


@router.post("/bank/auth", response_model=BankAuthInitResponse)
async def initiate_bank_auth(
    request: BankAuthInitRequest,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> BankAuthInitResponse:
    """Start bank authorization flow."""
    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato. Usa l'import CSV.")

    try:
        result = await provider.initiate_auth(
            institution_id=request.institution_id or "",
            country=request.country or "ES",
        )

        # Save pending connection. agreement_id holds the EB `state` so the
        # callback can be correlated if needed.
        connection = BankConnection(
            user_id=current_user["sub"],
            requisition_id=result.requisition_id,
            agreement_id=result.agreement_id,
            institution_id=result.institution_id,
            institution_name=result.institution_name,
            status=BankConnectionStatus.PENDING,
        )
        db.add(connection)
        await db.commit()

        return BankAuthInitResponse(
            auth_link=result.auth_link,
            requisition_id=result.requisition_id,
            institution_id=result.institution_id,
            institution_name=result.institution_name,
        )
    except Exception as e:
        logger.error(f"Error initiating bank auth: {e}")
        raise HTTPException(status_code=502, detail=f"Errore {provider.provider_name}: {str(e)}")


@router.post("/bank/callback", response_model=BankConnectionResponse)
async def bank_auth_callback(
    request: BankAuthCallbackRequest,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> BankConnectionResponse:
    """
    Complete bank authorization after the user redirects back.

    Enable Banking redirects with ?code=<code>&state=<state>; the `code` differs
    from the saved authorization id, so we match the most recent PENDING
    connection for the user rather than by requisition_id. The provider then
    exchanges the token (code) for a session and we activate the connection.
    """
    # The token to hand to the provider: EB `code`, else legacy requisition_id.
    token = request.code or request.requisition_id
    if not token:
        raise HTTPException(status_code=400, detail="Codice di autorizzazione mancante")

    # Match the most recent PENDING connection for this user.
    result = await db.execute(
        select(BankConnection)
        .where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.PENDING)
        )
        .order_by(BankConnection.created_at.desc())
    )
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connessione in attesa non trovata")

    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato")

    try:
        # Complete auth via provider (exchange code -> session -> accounts)
        accounts = await provider.complete_auth(token)

        if not accounts:
            raise HTTPException(status_code=400, detail="Nessun conto trovato")

        # Every account of the consent is stored (Revolut: one per currency) with
        # the session id, so more accounts can be enabled later without a new
        # SCA. The primary (first EUR) one stays on the connection for sync.
        for row in save_accounts(connection, accounts):
            db.add(row)
        connection.status = BankConnectionStatus.ACTIVE
        # The expiry the bank actually granted; 90 days only if not reported.
        connection.expires_at = accounts[0].valid_until or (datetime.utcnow() + timedelta(days=90))
        connection.last_sync_error = None
        db.add(connection)

        # A reconnect (renewal) supersedes the previous connection(s).
        previous = await db.execute(
            select(BankConnection).where(
                (BankConnection.user_id == current_user["sub"])
                & (BankConnection.status == BankConnectionStatus.ACTIVE)
                & (BankConnection.id != connection.id)
            )
        )
        for old in previous.scalars().all():
            old.status = BankConnectionStatus.EXPIRED
            old.last_sync_error = SUPERSEDED_MSG
            db.add(old)

        await db.commit()
        await db.refresh(connection)

        return BankConnectionResponse.from_orm(connection)

    except HTTPException:
        raise
    except Exception as e:
        connection.status = BankConnectionStatus.ERROR
        connection.last_sync_error = str(e)
        db.add(connection)
        await db.commit()
        logger.error(f"Error in bank callback: {e}")
        raise HTTPException(status_code=502, detail=f"Errore: {str(e)}")


@router.get("/bank/connection", response_model=Optional[BankConnectionResponse])
async def get_bank_connection(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current active bank connection."""
    connection = await active_connection(db, view_user_id)
    if not connection:
        return None
    return BankConnectionResponse.from_orm(connection)


@router.get("/bank/balance", response_model=List[BankBalanceResponse])
async def get_bank_balance(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[BankBalanceResponse]:
    """Current balance of every account of the active connection (cached)."""
    connection = await active_connection(db, view_user_id)
    if not connection or not connection.account_id:
        raise HTTPException(status_code=404, detail="Nessun conto bancario collegato")

    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato")

    try:
        pairs = await account_balances(db, connection, provider)
    except BankSessionExpired:
        await expire_connection(db, connection, SESSION_REVOKED_MSG)
        raise HTTPException(status_code=409, detail=SESSION_REVOKED_MSG)
    return [
        BankBalanceResponse(amount=b.amount, currency=b.currency, balance_type="cached" if b.stale else "current")
        for _, b in pairs if b is not None
    ]


@router.patch("/bank/accounts/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: str,
    body: BankAccountUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> BankAccountResponse:
    """Include/exclude an account from the transaction sync.

    Only accounts in the primary account's currency can be enabled:
    Transaction has no currency, so a USD account would pollute the EUR totals.
    """
    result = await db.execute(
        select(BankAccount).where(
            (BankAccount.id == account_id) & (BankAccount.user_id == current_user["sub"])
        )
    )
    account = result.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Conto non trovato")
    if account.is_primary and not body.sync_enabled:
        raise HTTPException(status_code=400, detail="Il conto principale resta sempre sincronizzato")
    if body.sync_enabled:
        primary = await db.execute(
            select(BankAccount.currency).where(
                (BankAccount.connection_id == account.connection_id) & (BankAccount.is_primary == True)  # noqa: E712
            )
        )
        primary_currency = primary.scalar() or "EUR"
        if account.currency != primary_currency:
            raise HTTPException(
                status_code=400,
                detail=f"Solo i conti in {primary_currency} possono entrare nel bilancio",
            )
    account.sync_enabled = body.sync_enabled
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return BankAccountResponse.from_orm(account)


@router.post("/bank/sync", response_model=CSVImportResponse)
async def sync_bank_transactions(
    days_back: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CSVImportResponse:
    """
    Sync transactions from the configured bank provider (every sync-enabled
    account of the active connection), then refresh the cached balances — the
    user is present, so this is the moment to spend a bank call.
    Deduplicates by external_id (per user), plus a content match against rows
    from previous connections (reconnects may re-key transactions).
    """
    connection = await active_connection(db, current_user["sub"])
    if not connection or not connection.account_id:
        # 409 (not 404) when the consent just lapsed: the UI reloads into the
        # "ricollega" state instead of reporting a generic failure.
        latest = await latest_connection(db, current_user["sub"])
        if latest and latest.status == BankConnectionStatus.EXPIRED:
            raise HTTPException(status_code=409, detail=latest.last_sync_error or CONSENT_EXPIRED_MSG)
        raise HTTPException(status_code=404, detail="Nessun conto collegato")

    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato. Usa l'import CSV.")

    try:
        stats = await sync_connection(db, connection, provider, days_back=days_back)
        await account_balances(db, connection, provider, force=True)
    except BankSessionExpired:
        # Raised by a fetch; drop any rows staged for earlier accounts. The
        # rollback expires ORM state, so reload before touching the connection.
        await db.rollback()
        await db.refresh(connection)
        await expire_connection(db, connection, SESSION_REVOKED_MSG)
        raise HTTPException(status_code=409, detail=SESSION_REVOKED_MSG)
    except Exception as e:
        await db.rollback()
        await db.refresh(connection)
        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_error = str(e)
        db.add(connection)
        await db.commit()
        logger.error(f"Error syncing bank transactions: {e}")
        raise HTTPException(status_code=502, detail=f"Errore sync: {str(e)}")

    return CSVImportResponse(
        imported=stats.imported,
        skipped=stats.skipped,
        errors=stats.errors,
        auto_ticked=stats.auto_ticked,
        message=f"Sincronizzate {stats.imported} transazioni da {connection.institution_name or 'banca'}",
    )


@router.delete("/bank/connection")
async def disconnect_bank(
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect bank account."""
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        )
    )
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Nessun conto collegato")

    connection.status = BankConnectionStatus.EXPIRED
    db.add(connection)
    await db.commit()
    return {"message": "Conto disconnesso"}


# ═══════════════════════════════════════════════════════════════════════════════
#  CSV IMPORT
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/import/csv", response_model=CSVImportResponse)
async def import_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CSVImportResponse:
    """Import transactions from a Revolut CSV export.

    Skips rows already imported (external_id — checked globally, as the column
    is globally unique) and rows the bank sync already brought in (same day,
    amount and direction: the two sources describe a payment differently).
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Il file deve essere un CSV")

    user_id = current_user["sub"]
    content = await file.read()
    sub_kws = await subscription_keywords_for(db, user_id)
    parsed = parse_revolut_csv(content, user_id=str(user_id), sub_keywords=sub_kws)

    ext_ids = [t["external_id"] for t in parsed if t.get("external_id")]
    existing_ids: set[str] = set()
    if ext_ids:
        result = await db.execute(select(Transaction.external_id).where(Transaction.external_id.in_(ext_ids)))
        existing_ids = {row[0] for row in result.all()}

    bank_sigs: Counter = Counter()
    if parsed:
        dates = [t["date"] for t in parsed]
        result = await db.execute(
            select(Transaction.date, Transaction.amount, Transaction.transaction_type).where(
                (Transaction.user_id == user_id)
                & (Transaction.source == TransactionSource.BANK_SYNC)
                & (Transaction.date >= min(dates))
                & (Transaction.date <= max(dates))
            )
        )
        bank_sigs = Counter(loose_sig(*row) for row in result.all())

    imported = skipped = errors = from_bank = 0
    for tx_data in parsed:
        try:
            if tx_data.get("external_id") in existing_ids:
                skipped += 1
                continue
            sig = loose_sig(tx_data["date"], tx_data["amount"], tx_data["transaction_type"])
            if bank_sigs[sig] > 0:
                bank_sigs[sig] -= 1
                from_bank += 1
                continue
            db.add(Transaction(**tx_data))
            imported += 1
        except Exception as e:
            logger.warning(f"Error importing CSV transaction: {e}")
            errors += 1

    await db.commit()
    ticked = await auto_tick_safely(db, user_id)

    note = f" · {from_bank} già presenti dal sync bancario" if from_bank else ""
    return CSVImportResponse(
        imported=imported,
        skipped=skipped + from_bank,
        errors=errors,
        auto_ticked=ticked,
        message=f"Importate {imported} transazioni da CSV Revolut{note}",
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  TRANSACTIONS — CRUD
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    transaction: TransactionCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Create a manual transaction."""
    txn = Transaction(
        user_id=current_user["sub"],
        source=TransactionSource.MANUAL,
        **transaction.dict(),
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return TransactionResponse.from_orm(txn)


@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    month: int = Query(None),
    year: int = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[TransactionSource] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[TransactionResponse]:
    """List transactions with optional filters."""
    query = select(Transaction).where(Transaction.user_id == view_user_id)

    if month and year:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        query = query.where((Transaction.date >= start) & (Transaction.date <= end))

    if category:
        query = query.where(Transaction.category == category)

    if source:
        query = query.where(Transaction.source == source)

    query = query.order_by(Transaction.date.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    transactions = result.scalars().all()
    return [TransactionResponse.from_orm(t) for t in transactions]


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Get a specific transaction."""
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == transaction_id)
            & (Transaction.user_id == view_user_id)
        )
    )
    transaction = result.scalars().first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transazione non trovata"
        )
    return TransactionResponse.from_orm(transaction)


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    transaction_update: TransactionUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Update a transaction."""
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == transaction_id)
            & (Transaction.user_id == current_user["sub"])
        )
    )
    transaction = result.scalars().first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transazione non trovata"
        )

    update_data = transaction_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(transaction, field, value)

    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return TransactionResponse.from_orm(transaction)


@router.delete(
    "/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a transaction."""
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == transaction_id)
            & (Transaction.user_id == current_user["sub"])
        )
    )
    transaction = result.scalars().first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transazione non trovata"
        )

    await db.delete(transaction)
    await db.commit()


@router.post("/transactions/recategorize")
async def recategorize_transactions(
    only_uncategorized: bool = Query(False),
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Re-run the categoriser over imported transactions (CSV + bank sync) so the
    "Spese per categoria" panel reflects the current rules. Manual transactions
    are left untouched. With only_uncategorized=true, only re-buckets entries
    currently in "Altro" (or empty). Returns how many were updated.
    """
    result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user["sub"])
    )
    transactions = result.scalars().all()
    sub_kws = await subscription_keywords_for(db, current_user["sub"])

    updated = 0
    for txn in transactions:
        if txn.source == TransactionSource.MANUAL:
            continue
        if only_uncategorized and txn.category not in (None, "", "Altro"):
            continue
        new_cat = categorize(
            description=txn.description,
            merchant=txn.merchant_name,
            mcc=txn.merchant_category_code,
            is_income=(txn.transaction_type == TransactionType.INCOME),
            sub_keywords=sub_kws,
            bank_category=txn.bank_category,
            amount=txn.amount,
        )
        if new_cat != txn.category:
            txn.category = new_cat
            db.add(txn)
            updated += 1

    await db.commit()
    return {"updated": updated, "total": len(transactions)}


# ═══════════════════════════════════════════════════════════════════════════════
#  BUDGET DASHBOARD — Unified View
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/dashboard", response_model=BudgetDashboard)
async def get_budget_dashboard(
    month: int = Query(None),
    year: int = Query(None),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> BudgetDashboard:
    """
    Unified finance view for one month:
    - bank connection status, accounts and (cached) balances
    - income / expenses / category spending vs carried-forward limits
    - Scadenze money for the month + unpaid timeline, from the real deadlines
    - end-of-month forecast (current month only)
    """
    today = date.today()
    month = month or today.month
    year = year or today.year
    month_start = date(year, month, 1)
    month_end = date(year, month, monthrange(year, month)[1])

    dashboard = BudgetDashboard(month=month_start)

    # ── 1. Bank connection, accounts & balance ────────────────────────────────
    # active_connection flips a lapsed consent to EXPIRED here too — before,
    # the dashboard kept saying "Connesso" (with a silent null balance) until a
    # manual sync failed and the card suddenly read "nessuna banca collegata".
    bank_conn = await active_connection(db, view_user_id)

    if bank_conn and bank_conn.account_id:
        dashboard.bank_connected = True
        dashboard.bank_currency = (bank_conn.currency or "EUR").upper()
        provider = get_bank_provider()
        pairs = [(a, None) for a in await connection_accounts(db, bank_conn)]
        if provider:
            try:
                # Cached (≤ 1 bank call per account every few hours): every
                # server-side read is "unattended" for PSD2 and capped per day.
                pairs = await account_balances(db, bank_conn, provider)
            except Exception as e:
                # Deliberately NOT expiring on BankSessionExpired here: this runs
                # on every load (guests included) and a spurious 4xx would flip a
                # working connection to EXPIRED, undoable only by a new SCA. The
                # UI shows "saldo non disponibile"; the user-triggered sync (or
                # the consent date) is what marks the connection dead.
                logger.warning(f"Could not fetch balance for dashboard: {e}")

        total, at, stale = None, None, False
        for acc, bal in pairs:
            dashboard.bank_accounts.append(BankAccountSummary(
                id=getattr(acc, "id", None),
                name=acc.name,
                iban_tail=(acc.iban or "")[-4:] or None,
                currency=acc.currency,
                is_primary=acc.is_primary,
                sync_enabled=acc.sync_enabled,
                balance=bal.amount if bal else None,
                balance_at=bal.at if bal else None,
                balance_stale=bal.stale if bal else False,
            ))
            # "Saldo disponibile" = the accounts that feed the totals.
            if bal and acc.sync_enabled and acc.currency == dashboard.bank_currency:
                total = (total or 0.0) + bal.amount
                at = bal.at if at is None else min(at, bal.at)
                stale = stale or bal.stale
        dashboard.bank_balance = round(total, 2) if total is not None else None
        dashboard.bank_balance_at = at
        dashboard.bank_balance_stale = stale

    # Status of the live connection, else of the most recent dead one (a failed
    # reconnect attempt must not mask a still-working connection).
    shown = bank_conn if dashboard.bank_connected else await latest_connection(db, view_user_id)
    if shown:
        dashboard.bank_status = getattr(shown.status, "value", shown.status)
        dashboard.bank_institution = shown.institution_name
        dashboard.bank_expires_at = shown.expires_at
        dashboard.bank_error = shown.last_sync_error
        dashboard.bank_last_sync = shown.last_sync_at

    # ── 2. Monthly transactions ───────────────────────────────────────────────
    result = await db.execute(
        select(Transaction).where(
            (Transaction.user_id == view_user_id)
            & (Transaction.date >= month_start)
            & (Transaction.date <= month_end)
        ).order_by(Transaction.date.desc())
    )
    transactions = result.scalars().all()

    # Internal movements (top-ups, currency exchange, own-account transfers) are
    # not income/spending — keep them out of the totals.
    real = [t for t in transactions if t.category != TRANSFER_CATEGORY]
    income = sum(t.amount for t in real if t.transaction_type == TransactionType.INCOME)
    expenses = sum(t.amount for t in real if t.transaction_type == TransactionType.EXPENSE)

    dashboard.total_income = round(income, 2)
    dashboard.total_expenses = round(expenses, 2)
    dashboard.net_balance = round(income - expenses, 2)
    dashboard.recent_transactions = [TransactionResponse.from_orm(t) for t in transactions[:10]]

    # ── 3. Category spending vs limits ────────────────────────────────────────
    by_category: dict[str, float] = {}
    for txn in real:
        if txn.transaction_type == TransactionType.EXPENSE:
            by_category[txn.category] = by_category.get(txn.category, 0) + txn.amount

    limits = await _limits_for_month(db, view_user_id, month_end)
    for cat in sorted(set(by_category) | set(limits)):
        spent = round(by_category.get(cat, 0), 2)
        limit = limits.get(cat)
        dashboard.categories.append(CategorySpending(
            category=cat,
            spent=spent,
            limit=limit,
            remaining=round(limit - spent, 2) if limit else None,
            percentage=round((spent / limit) * 100, 1) if limit else 0,
        ))

    # ── 4. Scadenze — from the real deadlines ────────────────────────────────
    # (Was the legacy `scadenze` table: a hand-kept, non-per-user plan frozen
    # since June, shown above the real list with different numbers.)
    result = await db.execute(select(Deadline).where(Deadline.user_id == view_user_id))
    rows = rows_for(result.scalars().all(), today)

    month_totals = totals(in_range(rows, month_start, month_end))
    dashboard.scadenze_total = month_totals.total
    dashboard.scadenze_paid = month_totals.paid
    dashboard.scadenze_remaining = month_totals.remaining

    unpaid = sorted((r for r in rows if not r.paid and r.amount is not None), key=lambda r: r.date)
    dashboard.upcoming_scadenze = [
        _preview(r, today) for r in unpaid if today <= r.date <= today + timedelta(days=30)
    ]
    dashboard.overdue_scadenze = [
        _preview(r, today) for r in unpaid if today - timedelta(days=60) <= r.date < today
    ]

    # ── 5. End-of-month forecast (current month only) ─────────────────────────
    if month_start <= today <= month_end:
        due = totals(r for r in unpaid if month_start <= r.date <= month_end).total
        dashboard.forecast_due = due
        if dashboard.bank_balance is not None:
            dashboard.forecast_balance = round(dashboard.bank_balance - due, 2)

    return dashboard


def _preview(r, today: date) -> ScadenzaPreview:
    d = r.deadline
    label = d.title + (f" · rata {r.index}/{r.total}" if r.index else "")
    return ScadenzaPreview(
        id=r.key,
        desc=label,
        importo=r.amount or 0,
        scadenza_gg_mm=r.date.strftime("%d/%m"),
        tipo=getattr(d.recurrence_type, "value", d.recurrence_type) or "none",
        pagato=r.paid,
        days_until=(r.date - today).days,
        is_overdue=r.date < today,
        matched_transaction=r.auto,
    )


async def _limits_for_month(db: AsyncSession, user_id, month_end: date) -> dict[str, float]:
    """Category limits in force for a month: per category, the latest goal set
    on or before it (a limit carries forward until changed; 0 = removed)."""
    result = await db.execute(
        select(BudgetGoal)
        .where((BudgetGoal.user_id == user_id) & (BudgetGoal.month <= month_end))
        .order_by(BudgetGoal.month.desc(), BudgetGoal.updated_at.desc())
    )
    latest: dict[str, float] = {}
    for g in result.scalars().all():
        latest.setdefault(g.category, g.monthly_limit)
    return {c: round(v, 2) for c, v in latest.items() if v and v > 0}


@router.put("/limits", response_model=CategoryLimitResponse)
async def set_category_limit(
    body: CategoryLimitSet,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CategoryLimitResponse:
    """Set (or remove, with null/0) a category's monthly limit from `month` on.

    Stored as a BudgetGoal dated the 1st of the month; later months inherit it
    until another limit is set.
    """
    m = (body.month or date.today()).replace(day=1)
    category = body.category.strip()
    limit = round(body.monthly_limit or 0, 2)
    result = await db.execute(
        select(BudgetGoal).where(
            (BudgetGoal.user_id == current_user["sub"])
            & (BudgetGoal.category == category)
            & (BudgetGoal.month == m)
        )
    )
    goal = result.scalars().first()
    if goal:
        goal.monthly_limit = limit
    else:
        goal = BudgetGoal(user_id=current_user["sub"], category=category, monthly_limit=limit, month=m)
    db.add(goal)
    await db.commit()
    return CategoryLimitResponse(category=category, monthly_limit=limit or None, month=m)


# ═══════════════════════════════════════════════════════════════════════════════
#  BUDGET SUMMARY & TRENDS (legacy + enhanced)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/summary", response_model=BudgetSummary)
async def get_budget_summary(
    month: int = Query(None),
    year: int = Query(None),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> BudgetSummary:
    """Get budget summary for a month."""
    if not month:
        month = date.today().month
    if not year:
        year = date.today().year

    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(Transaction).where(
            (Transaction.user_id == view_user_id)
            & (Transaction.date >= start)
            & (Transaction.date <= end)
        )
    )
    transactions = result.scalars().all()

    income = sum(t.amount for t in transactions if t.transaction_type == TransactionType.INCOME)
    expenses = sum(t.amount for t in transactions if t.transaction_type == TransactionType.EXPENSE)
    balance = income - expenses

    by_category = {}
    for txn in transactions:
        if txn.transaction_type == TransactionType.EXPENSE:
            by_category[txn.category] = by_category.get(txn.category, 0) + txn.amount

    # Get budget goals
    result = await db.execute(
        select(BudgetGoal).where(
            (BudgetGoal.user_id == view_user_id)
            & (BudgetGoal.month >= start)
            & (BudgetGoal.month <= end)
        )
    )
    goals = result.scalars().all()

    goals_dict = {}
    for goal in goals:
        spent = by_category.get(goal.category, 0)
        goals_dict[goal.category] = {
            "limit": goal.monthly_limit,
            "spent": spent,
            "remaining": goal.monthly_limit - spent,
        }

    return BudgetSummary(
        month=start,
        income=income,
        expenses=expenses,
        balance=balance,
        by_category=by_category,
        goals=goals_dict,
    )


@router.get("/trends", response_model=BudgetTrends)
async def get_budget_trends(
    period: str = Query("3months"),
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> BudgetTrends:
    """Get budget trends."""
    if period == "3months":
        months = 3
    elif period == "6months":
        months = 6
    elif period == "1year":
        months = 12
    else:
        months = 3

    today = date.today()
    month_list = []
    monthly_income = []
    monthly_expenses = []
    monthly_balance = []

    for i in range(months - 1, -1, -1):
        current_month = today.replace(day=1) - timedelta(days=30 * i)
        month_list.append(current_month)

        start = current_month.replace(day=1)
        end = date(
            current_month.year,
            current_month.month,
            monthrange(current_month.year, current_month.month)[1],
        )

        result = await db.execute(
            select(Transaction).where(
                (Transaction.user_id == view_user_id)
                & (Transaction.date >= start)
                & (Transaction.date <= end)
            )
        )
        transactions = result.scalars().all()

        income = sum(t.amount for t in transactions if t.transaction_type == TransactionType.INCOME)
        expenses = sum(t.amount for t in transactions if t.transaction_type == TransactionType.EXPENSE)

        monthly_income.append(income)
        monthly_expenses.append(expenses)
        monthly_balance.append(income - expenses)

    return BudgetTrends(
        period=period,
        months=month_list,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_balance=monthly_balance,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  BUDGET GOALS — CRUD
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/goals",
    response_model=BudgetGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_budget_goal(
    goal: BudgetGoalCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> BudgetGoalResponse:
    """Create a budget goal."""
    budget_goal = BudgetGoal(
        user_id=current_user["sub"],
        **goal.dict(),
    )
    db.add(budget_goal)
    await db.commit()
    await db.refresh(budget_goal)
    return BudgetGoalResponse.from_orm(budget_goal)


@router.get("/goals", response_model=List[BudgetGoalResponse])
async def list_budget_goals(
    view_user_id: str = Depends(get_view_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[BudgetGoalResponse]:
    """List budget goals."""
    result = await db.execute(
        select(BudgetGoal).where(BudgetGoal.user_id == view_user_id)
    )
    goals = result.scalars().all()
    return [BudgetGoalResponse.from_orm(g) for g in goals]


@router.put("/goals/{goal_id}", response_model=BudgetGoalResponse)
async def update_budget_goal(
    goal_id: str,
    goal_update: BudgetGoalUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> BudgetGoalResponse:
    """Update a budget goal."""
    result = await db.execute(
        select(BudgetGoal).where(
            (BudgetGoal.id == goal_id)
            & (BudgetGoal.user_id == current_user["sub"])
        )
    )
    goal = result.scalars().first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal non trovato")

    for field, value in goal_update.dict(exclude_unset=True).items():
        if value is not None:
            setattr(goal, field, value)

    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return BudgetGoalResponse.from_orm(goal)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_goal(
    goal_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a budget goal."""
    result = await db.execute(
        select(BudgetGoal).where(
            (BudgetGoal.id == goal_id)
            & (BudgetGoal.user_id == current_user["sub"])
        )
    )
    goal = result.scalars().first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal non trovato")

    await db.delete(goal)
    await db.commit()
