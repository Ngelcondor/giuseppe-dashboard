"""Budget, transaction, bank connection, and CSV import endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import date, datetime, timedelta
from typing import List, Optional
from calendar import monthrange

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.budget import (
    Transaction,
    BudgetGoal,
    BankConnection,
    BankConnectionStatus,
    TransactionType,
    TransactionSource,
    DEFAULT_CATEGORY_MAP,
)
from app.models.scadenza import Scadenza
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
    BankBalanceResponse,
    InstitutionResponse,
    CSVImportResponse,
)
from app.services.bank_factory import get_bank_provider
from app.services.csv_import_service import parse_revolut_csv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget", tags=["budget"])

MESI_NUM = {
    "Gennaio": 1, "Febbraio": 2, "Marzo": 3, "Aprile": 4,
    "Maggio": 5, "Giugno": 6, "Luglio": 7, "Agosto": 8,
    "Settembre": 9, "Ottobre": 10, "Novembre": 11, "Dicembre": 12,
}


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

        # Use first account; account_id is the provider account UID for later calls
        acc = accounts[0]
        connection.account_id = acc.account_id
        connection.account_iban = acc.iban
        connection.account_name = acc.name or "Conto"
        connection.currency = acc.currency
        connection.status = BankConnectionStatus.ACTIVE
        connection.expires_at = datetime.utcnow() + timedelta(days=90)
        connection.last_sync_error = None

        db.add(connection)
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current active bank connection."""
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        ).order_by(BankConnection.created_at.desc())
    )
    connection = result.scalars().first()
    if not connection:
        return None
    return BankConnectionResponse.from_orm(connection)


@router.get("/bank/balance", response_model=List[BankBalanceResponse])
async def get_bank_balance(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[BankBalanceResponse]:
    """Get current bank account balance."""
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        ).order_by(BankConnection.created_at.desc())
    )
    connection = result.scalars().first()
    if not connection or not connection.account_id:
        raise HTTPException(status_code=404, detail="Nessun conto bancario collegato")

    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato")

    try:
        balances = await provider.get_balances(connection.account_id)
        return [
            BankBalanceResponse(
                amount=b.amount,
                currency=b.currency,
                balance_type=b.balance_type,
            )
            for b in balances
        ]
    except Exception as e:
        logger.error(f"Error fetching balance: {e}")
        raise HTTPException(status_code=502, detail=f"Errore recupero saldo: {str(e)}")


@router.post("/bank/sync", response_model=CSVImportResponse)
async def sync_bank_transactions(
    days_back: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> CSVImportResponse:
    """
    Sync transactions from bank via GoCardless.
    Deduplicates by external_id.
    """
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        ).order_by(BankConnection.created_at.desc())
    )
    connection = result.scalars().first()
    if not connection or not connection.account_id:
        raise HTTPException(status_code=404, detail="Nessun conto collegato")

    provider = get_bank_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="Nessun provider bancario configurato. Usa l'import CSV.")

    try:
        date_from = date.today() - timedelta(days=days_back)
        tx_data = await provider.get_transactions(
            connection.account_id,
            date_from=date_from,
        )

        imported = 0
        skipped = 0
        errors = 0

        for tx in tx_data.booked:
            try:
                ext_id = tx.transaction_id
                if not ext_id:
                    errors += 1
                    continue

                # Check dedup
                existing = await db.execute(
                    select(Transaction).where(Transaction.external_id == ext_id)
                )
                if existing.scalars().first():
                    skipped += 1
                    continue

                txn_type = TransactionType.INCOME if tx.amount > 0 else TransactionType.EXPENSE

                # Category from MCC
                mcc = tx.merchant_category_code or ""
                category = DEFAULT_CATEGORY_MAP.get(mcc, "Altro")

                new_tx = Transaction(
                    user_id=current_user["sub"],
                    amount=abs(tx.amount),
                    category=category,
                    description=(tx.description or "N/A")[:500],
                    transaction_type=txn_type,
                    date=tx.booking_date or date.today(),
                    source=TransactionSource.BANK_SYNC,
                    external_id=ext_id,
                    bank_connection_id=connection.id,
                    merchant_name=tx.creditor_name or tx.debtor_name,
                    merchant_category_code=mcc,
                    bank_category=tx.bank_transaction_code,
                    raw_description=str(tx.raw_data)[:2000],
                )
                db.add(new_tx)
                imported += 1

            except Exception as e:
                logger.warning(f"Error parsing bank transaction: {e}")
                errors += 1

        # Update connection sync time
        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_error = None
        db.add(connection)

        await db.commit()

        return CSVImportResponse(
            imported=imported,
            skipped=skipped,
            errors=errors,
            message=f"Sincronizzate {imported} transazioni da Revolut",
        )

    except HTTPException:
        raise
    except Exception as e:
        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_error = str(e)
        db.add(connection)
        await db.commit()
        logger.error(f"Error syncing bank transactions: {e}")
        raise HTTPException(status_code=502, detail=f"Errore sync: {str(e)}")


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
    """Import transactions from a Revolut CSV export."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Il file deve essere un CSV")

    content = await file.read()
    parsed = parse_revolut_csv(content, user_id=str(current_user["sub"]))

    imported = 0
    skipped = 0
    errors = 0

    for tx_data in parsed:
        try:
            # Dedup by external_id
            if tx_data.get("external_id"):
                existing = await db.execute(
                    select(Transaction).where(
                        Transaction.external_id == tx_data["external_id"]
                    )
                )
                if existing.scalars().first():
                    skipped += 1
                    continue

            txn = Transaction(**tx_data)
            db.add(txn)
            imported += 1
        except Exception as e:
            logger.warning(f"Error importing CSV transaction: {e}")
            errors += 1

    await db.commit()

    return CSVImportResponse(
        imported=imported,
        skipped=skipped,
        errors=errors,
        message=f"Importate {imported} transazioni da CSV Revolut",
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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TransactionResponse]:
    """List transactions with optional filters."""
    query = select(Transaction).where(Transaction.user_id == current_user["sub"])

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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Get a specific transaction."""
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


# ═══════════════════════════════════════════════════════════════════════════════
#  BUDGET DASHBOARD — Unified View
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/dashboard", response_model=BudgetDashboard)
async def get_budget_dashboard(
    month: int = Query(None),
    year: int = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetDashboard:
    """
    Get unified budget dashboard combining:
    - Bank balance (if connected)
    - Monthly transactions summary
    - Category spending vs goals
    - Upcoming scadenze with matching
    """
    if not month:
        month = date.today().month
    if not year:
        year = date.today().year

    today = date.today()
    month_start = date(year, month, 1)
    month_end = date(year, month, monthrange(year, month)[1])

    dashboard = BudgetDashboard(month=month_start)

    # ── 1. Bank connection & balance ──────────────────────────────────────────
    result = await db.execute(
        select(BankConnection).where(
            (BankConnection.user_id == current_user["sub"])
            & (BankConnection.status == BankConnectionStatus.ACTIVE)
        ).order_by(BankConnection.created_at.desc())
    )
    bank_conn = result.scalars().first()

    if bank_conn and bank_conn.account_id:
        dashboard.bank_connected = True
        dashboard.bank_currency = bank_conn.currency or "EUR"
        dashboard.bank_last_sync = bank_conn.last_sync_at

        provider = get_bank_provider()
        if provider:
            try:
                balances = await provider.get_balances(bank_conn.account_id)
                logger.info(
                    "EB balances for %s: %s",
                    bank_conn.account_id,
                    [(b.balance_type, b.amount, b.currency) for b in balances],
                )
                # Prefer a "current" balance type, but fall back to whatever the
                # bank returns — EB/ASPSPs use varied balance_type codes.
                preferred = (
                    "closingBooked", "expected", "interimAvailable", "interimBooked",
                    "openingBooked", "authorised", "forwardAvailable", "information",
                )
                chosen = next((b for b in balances if b.balance_type in preferred), None)
                if chosen is None and balances:
                    chosen = balances[0]
                if chosen is not None:
                    dashboard.bank_balance = chosen.amount
                    if chosen.currency:
                        dashboard.bank_currency = chosen.currency
            except Exception as e:
                logger.warning(f"Could not fetch balance for dashboard: {e}")

    # ── 2. Monthly transactions ───────────────────────────────────────────────
    result = await db.execute(
        select(Transaction).where(
            (Transaction.user_id == current_user["sub"])
            & (Transaction.date >= month_start)
            & (Transaction.date <= month_end)
        ).order_by(Transaction.date.desc())
    )
    transactions = result.scalars().all()

    income = sum(t.amount for t in transactions if t.transaction_type == TransactionType.INCOME)
    expenses = sum(t.amount for t in transactions if t.transaction_type == TransactionType.EXPENSE)

    dashboard.total_income = round(income, 2)
    dashboard.total_expenses = round(expenses, 2)
    dashboard.net_balance = round(income - expenses, 2)

    # Recent transactions (last 10)
    dashboard.recent_transactions = [
        TransactionResponse.from_orm(t) for t in transactions[:10]
    ]

    # ── 3. Category spending vs goals ─────────────────────────────────────────
    by_category: dict[str, float] = {}
    for txn in transactions:
        if txn.transaction_type == TransactionType.EXPENSE:
            by_category[txn.category] = by_category.get(txn.category, 0) + txn.amount

    # Get budget goals for this month
    result = await db.execute(
        select(BudgetGoal).where(
            (BudgetGoal.user_id == current_user["sub"])
            & (BudgetGoal.month >= month_start)
            & (BudgetGoal.month <= month_end)
        )
    )
    goals = {g.category: g.monthly_limit for g in result.scalars().all()}

    # Build category list
    all_categories = set(list(by_category.keys()) + list(goals.keys()))
    for cat in sorted(all_categories):
        spent = round(by_category.get(cat, 0), 2)
        limit = goals.get(cat)
        remaining = round(limit - spent, 2) if limit else None
        percentage = round((spent / limit) * 100, 1) if limit and limit > 0 else 0

        dashboard.categories.append(
            CategorySpending(
                category=cat,
                spent=spent,
                limit=limit,
                remaining=remaining,
                percentage=percentage,
            )
        )

    # ── 4. Scadenze for current month ─────────────────────────────────────────
    mese_nome = None
    for nome, num in MESI_NUM.items():
        if num == month:
            mese_nome = nome
            break

    if mese_nome:
        result = await db.execute(
            select(Scadenza).where(Scadenza.mese == mese_nome)
            .order_by(Scadenza.scadenza_gg_mm)
        )
        scadenze = result.scalars().all()

        total_uscite = sum(s.importo for s in scadenze if s.importo < 0)
        total_pagate = sum(s.importo for s in scadenze if s.importo < 0 and s.pagato)

        dashboard.scadenze_total = round(abs(total_uscite), 2)
        dashboard.scadenze_paid = round(abs(total_pagate), 2)
        dashboard.scadenze_remaining = round(abs(total_uscite) - abs(total_pagate), 2)

        for s in scadenze:
            try:
                parts = s.scadenza_gg_mm.split("/")
                day = int(parts[0])
                mon = int(parts[1])
                scad_date = date(year, mon, day)
                days_until = (scad_date - today).days
                is_overdue = days_until < 0 and not s.pagato

                preview = ScadenzaPreview(
                    id=s.id,
                    desc=s.desc,
                    importo=s.importo,
                    scadenza_gg_mm=s.scadenza_gg_mm,
                    tipo=s.tipo.value if hasattr(s.tipo, 'value') else str(s.tipo),
                    pagato=s.pagato,
                    days_until=days_until,
                    is_overdue=is_overdue,
                    matched_transaction=False,
                )

                if is_overdue:
                    dashboard.overdue_scadenze.append(preview)
                elif days_until <= 30 and not s.pagato:
                    dashboard.upcoming_scadenze.append(preview)

            except (ValueError, IndexError):
                continue

    return dashboard


# ═══════════════════════════════════════════════════════════════════════════════
#  BUDGET SUMMARY & TRENDS (legacy + enhanced)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/summary", response_model=BudgetSummary)
async def get_budget_summary(
    month: int = Query(None),
    year: int = Query(None),
    current_user: dict = Depends(get_current_user),
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
            (Transaction.user_id == current_user["sub"])
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
            (BudgetGoal.user_id == current_user["sub"])
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
    current_user: dict = Depends(get_current_user),
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
                (Transaction.user_id == current_user["sub"])
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[BudgetGoalResponse]:
    """List budget goals."""
    result = await db.execute(
        select(BudgetGoal).where(BudgetGoal.user_id == current_user["sub"])
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
