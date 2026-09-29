"""Budget, transaction, and bank connection schemas."""
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict
import uuid
from app.models.budget import (
    TransactionType,
    TransactionSource,
    RecurringFrequency,
    BankConnectionStatus,
)


# ─── Bank Connection Schemas ──────────────────────────────────────────────────


class BankConnectionResponse(BaseModel):
    """Bank connection response."""

    id: uuid.UUID
    user_id: uuid.UUID
    institution_id: str
    institution_name: str
    account_id: Optional[str] = None
    account_iban: Optional[str] = None
    account_name: Optional[str] = None
    currency: str = "EUR"
    status: BankConnectionStatus
    last_sync_at: Optional[datetime] = None
    last_sync_error: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BankAuthInitRequest(BaseModel):
    """Request to initiate bank auth."""

    institution_id: Optional[str] = None
    country: Optional[str] = "ES"


class BankAuthInitResponse(BaseModel):
    """Response with auth link."""

    auth_link: str
    requisition_id: str
    institution_id: str
    institution_name: str


class BankAuthCallbackRequest(BaseModel):
    """Request after bank auth callback.

    Enable Banking returns a `code` (+ `state`) on the redirect; GoCardless used
    a `requisition_id`. All are optional for cross-provider compatibility.
    """

    code: Optional[str] = None
    state: Optional[str] = None
    requisition_id: Optional[str] = None


class BankBalanceResponse(BaseModel):
    """Current bank balance."""

    amount: float
    currency: str
    balance_type: str  # "closingBooked", "expected", etc.


class BankAccountResponse(BaseModel):
    """One account of a bank connection."""

    id: uuid.UUID
    name: Optional[str] = None
    iban: Optional[str] = None
    currency: str = "EUR"
    is_primary: bool = False
    sync_enabled: bool = False

    class Config:
        from_attributes = True


class BankAccountUpdate(BaseModel):
    """Include/exclude an account from the transaction sync."""

    sync_enabled: bool


class BankAccountSummary(BaseModel):
    """Account + cached balance, as shown in the Conto card."""

    id: Optional[uuid.UUID] = None   # None for pre-multi-account connections
    name: Optional[str] = None
    iban_tail: Optional[str] = None  # last 4 chars only
    currency: str = "EUR"
    is_primary: bool = False
    sync_enabled: bool = False
    balance: Optional[float] = None
    balance_at: Optional[datetime] = None
    balance_stale: bool = False


class InstitutionResponse(BaseModel):
    """Available banking institution."""

    id: str
    name: str
    logo: Optional[str] = None
    countries: Optional[List[str]] = None


# ─── Transaction Schemas ──────────────────────────────────────────────────────


class TransactionBase(BaseModel):
    """Base transaction schema."""

    amount: float = Field(..., gt=0)
    category: str
    description: Optional[str] = None
    transaction_type: TransactionType
    date: date
    is_recurring: bool = False
    recurring_frequency: Optional[RecurringFrequency] = None
    recurring_end_date: Optional[date] = None
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    """Transaction creation schema."""

    pass


class TransactionUpdate(BaseModel):
    """Transaction update schema."""

    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    description: Optional[str] = None
    transaction_type: Optional[TransactionType] = None
    date: Optional[date] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[RecurringFrequency] = None
    recurring_end_date: Optional[date] = None
    notes: Optional[str] = None
    linked_scadenza_id: Optional[uuid.UUID] = None


class TransactionResponse(TransactionBase):
    """Transaction response schema."""

    # Override TransactionBase's gt=0 constraint: bank feeds legitimately include
    # €0 entries (authorisation holds, reversals). Output must never reject them.
    amount: float

    id: uuid.UUID
    user_id: uuid.UUID
    source: TransactionSource = TransactionSource.MANUAL
    external_id: Optional[str] = None
    merchant_name: Optional[str] = None
    merchant_category_code: Optional[str] = None
    bank_category: Optional[str] = None
    raw_description: Optional[str] = None
    linked_scadenza_id: Optional[uuid.UUID] = None
    # Deadline occurrence this transaction paid (bank auto-tick).
    linked_deadline_id: Optional[uuid.UUID] = None
    linked_occurrence: Optional[date] = None
    bank_connection_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Budget Goal Schemas ──────────────────────────────────────────────────────


class BudgetGoalBase(BaseModel):
    """Base budget goal schema."""

    category: str
    # ge=0 on output: a 0 goal is a "limit removed from this month" marker.
    monthly_limit: float = Field(..., ge=0)
    month: date
    notes: Optional[str] = None


class BudgetGoalCreate(BudgetGoalBase):
    """Budget goal creation schema."""

    monthly_limit: float = Field(..., gt=0)


class CategoryLimitSet(BaseModel):
    """Set a category's monthly limit from `month` on (null/0 removes it)."""

    category: str = Field(..., min_length=1, max_length=100)
    monthly_limit: Optional[float] = Field(None, ge=0)
    month: Optional[date] = None  # defaults to the current month


class CategoryLimitResponse(BaseModel):
    category: str
    monthly_limit: Optional[float] = None
    month: date


class BudgetGoalUpdate(BaseModel):
    """Budget goal update schema."""

    category: Optional[str] = None
    monthly_limit: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class BudgetGoalResponse(BudgetGoalBase):
    """Budget goal response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Summary & Dashboard Schemas ─────────────────────────────────────────────


class CategorySpending(BaseModel):
    """Spending for a single category."""

    category: str
    spent: float
    limit: Optional[float] = None
    remaining: Optional[float] = None
    percentage: float = 0.0  # 0-100


class ScadenzaPreview(BaseModel):
    """One unpaid deadline occurrence for the dashboard timeline."""

    id: str                      # "<deadline uuid>@<YYYY-MM-DD>"
    desc: str
    importo: float
    scadenza_gg_mm: str
    tipo: str
    pagato: bool
    days_until: int
    is_overdue: bool = False
    matched_transaction: bool = False


class BudgetSummary(BaseModel):
    """Budget summary for a month."""

    month: date
    income: float
    expenses: float
    balance: float
    by_category: Dict[str, float]
    goals: Dict[str, Dict[str, float]]  # category -> {limit, spent, remaining}


class BudgetDashboard(BaseModel):
    """Full budget dashboard response."""

    # Bank info
    bank_connected: bool = False
    bank_balance: Optional[float] = None
    bank_currency: str = "EUR"
    bank_last_sync: Optional[datetime] = None
    # Latest non-pending connection, even when it's no longer usable, so the UI
    # can say "consenso scaduto il …" instead of "nessuna banca collegata".
    bank_status: Optional[str] = None          # active | expired | error
    bank_institution: Optional[str] = None
    bank_expires_at: Optional[datetime] = None
    bank_error: Optional[str] = None
    # When the shown balance was read from the bank (it's cached — PSD2 caps
    # unattended reads) and whether it's a last-known value after a failure.
    bank_balance_at: Optional[datetime] = None
    bank_balance_stale: bool = False
    bank_accounts: List[BankAccountSummary] = []

    # End-of-month forecast (current month only): balance minus the unpaid
    # deadlines still due this month. Covers registered Scadenze only.
    forecast_due: Optional[float] = None
    forecast_balance: Optional[float] = None

    # Monthly summary
    month: date
    total_income: float = 0
    total_expenses: float = 0
    net_balance: float = 0

    # Category breakdown
    categories: List[CategorySpending] = []

    # Unpaid deadline occurrences: next 30 days / overdue (last 60 days)
    upcoming_scadenze: List[ScadenzaPreview] = []
    overdue_scadenze: List[ScadenzaPreview] = []

    # Scadenze money for the selected month (same numbers as its month header)
    scadenze_total: float = 0
    scadenze_paid: float = 0
    scadenze_remaining: float = 0

    # Recent transactions
    recent_transactions: List[TransactionResponse] = []


class BudgetTrends(BaseModel):
    """Budget trends over time."""

    period: str  # "3months", "6months", "1year"
    months: List[date]
    monthly_income: List[float]
    monthly_expenses: List[float]
    monthly_balance: List[float]


class CSVImportResponse(BaseModel):
    """Response after CSV import."""

    imported: int
    skipped: int
    errors: int
    message: str
    # Deadlines auto-marked paid from the imported transactions.
    auto_ticked: int = 0
