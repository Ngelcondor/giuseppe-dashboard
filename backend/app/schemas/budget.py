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
    country: str = "FR"


class BankAuthInitResponse(BaseModel):
    """Response with auth link."""

    auth_link: str
    requisition_id: str
    institution_id: str
    institution_name: str


class BankAuthCallbackRequest(BaseModel):
    """Request after bank auth callback."""

    requisition_id: str


class BankBalanceResponse(BaseModel):
    """Current bank balance."""

    amount: float
    currency: str
    balance_type: str  # "closingBooked", "expected", etc.


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

    id: uuid.UUID
    user_id: uuid.UUID
    source: TransactionSource = TransactionSource.MANUAL
    external_id: Optional[str] = None
    merchant_name: Optional[str] = None
    merchant_category_code: Optional[str] = None
    bank_category: Optional[str] = None
    raw_description: Optional[str] = None
    linked_scadenza_id: Optional[uuid.UUID] = None
    bank_connection_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Budget Goal Schemas ──────────────────────────────────────────────────────


class BudgetGoalBase(BaseModel):
    """Base budget goal schema."""

    category: str
    monthly_limit: float = Field(..., gt=0)
    month: date
    notes: Optional[str] = None


class BudgetGoalCreate(BudgetGoalBase):
    """Budget goal creation schema."""

    pass


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
    """Upcoming deadline preview for budget dashboard."""

    id: uuid.UUID
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

    # Monthly summary
    month: date
    total_income: float = 0
    total_expenses: float = 0
    net_balance: float = 0

    # Category breakdown
    categories: List[CategorySpending] = []

    # Upcoming scadenze (next 30 days)
    upcoming_scadenze: List[ScadenzaPreview] = []
    overdue_scadenze: List[ScadenzaPreview] = []

    # Scadenze stats for current month
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
