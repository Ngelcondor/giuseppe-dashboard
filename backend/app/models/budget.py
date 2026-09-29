"""Budget and finance tracking models."""
from sqlalchemy import (
    Column, String, Float, DateTime, Boolean, Date,
    Enum as SQLEnum, ForeignKey, Text, Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, date
from enum import Enum

from app.core.database import Base


class TransactionType(str, Enum):
    """Transaction type."""

    INCOME = "income"
    EXPENSE = "expense"


class TransactionSource(str, Enum):
    """Where the transaction came from."""

    MANUAL = "manual"
    BANK_SYNC = "bank_sync"
    CSV_IMPORT = "csv_import"


class RecurringFrequency(str, Enum):
    """Recurring frequency."""

    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


class BankConnectionStatus(str, Enum):
    """Bank connection status."""

    ACTIVE = "active"
    EXPIRED = "expired"
    ERROR = "error"
    PENDING = "pending"


# ─── Bank Connection (GoCardless / Open Banking) ─────────────────────────────


class BankConnection(Base):
    """Bank account connection via GoCardless Open Banking."""

    __tablename__ = "bank_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # GoCardless identifiers
    requisition_id = Column(String(255), nullable=True, unique=True)
    agreement_id = Column(String(255), nullable=True)
    institution_id = Column(String(100), nullable=False)  # e.g. "REVOLUT_REVOGB21"
    institution_name = Column(String(255), nullable=False, default="Revolut")

    # Account info (populated after auth)
    account_id = Column(String(255), nullable=True, index=True)
    account_iban = Column(String(50), nullable=True)
    account_name = Column(String(255), nullable=True)
    currency = Column(String(10), default="EUR")

    # Connection status
    status = Column(
        String(20),
        default="pending",
        server_default="pending",
        nullable=False,
    )
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_error = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    # Provider session (Enable Banking session_id) — lets us re-read the
    # session's account list without a new SCA. Nullable: added by
    # _sync_missing_columns on existing DBs.
    session_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="bank_connection")

    def __repr__(self) -> str:
        return f"<BankConnection(id={self.id}, institution={self.institution_name}, status={self.status})>"


class BankAccount(Base):
    """One account of a bank connection (a consent can cover several: Revolut
    returns one per currency). Only sync_enabled accounts feed transactions;
    by default just the primary one, so own-account transfers and foreign
    currencies (Transaction has no currency) never mix into the EUR totals."""

    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(
        UUID(as_uuid=True), ForeignKey("bank_connections.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    account_uid = Column(String(255), nullable=False)  # provider id for balance/tx calls
    iban = Column(String(50), nullable=True)
    name = Column(String(255), nullable=True)
    currency = Column(String(10), nullable=False, default="EUR")
    is_primary = Column(Boolean, nullable=False, default=False)
    sync_enabled = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<BankAccount(uid={self.account_uid}, currency={self.currency}, primary={self.is_primary})>"


# ─── Transaction ──────────────────────────────────────────────────────────────


class Transaction(Base):
    """Financial transaction tracking."""

    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    amount = Column(Float, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)

    date = Column(Date, nullable=False, index=True)

    # Source tracking
    source = Column(
        String(20),
        default="manual",
        server_default="manual",
        nullable=True,
    )

    # Bank sync fields (from GoCardless)
    external_id = Column(String(255), nullable=True, unique=True, index=True)
    bank_connection_id = Column(
        UUID(as_uuid=True), ForeignKey("bank_connections.id"), nullable=True
    )
    merchant_name = Column(String(255), nullable=True)
    merchant_category_code = Column(String(10), nullable=True)
    bank_category = Column(String(100), nullable=True)
    raw_description = Column(Text, nullable=True)

    # Recurring transaction
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(
        SQLEnum(RecurringFrequency), nullable=True
    )
    recurring_end_date = Column(Date, nullable=True)

    # Link to scadenza (auto-match or manual)
    linked_scadenza_id = Column(
        UUID(as_uuid=True), ForeignKey("scadenze.id"), nullable=True, index=True
    )

    # The deadline occurrence this transaction paid (bank auto-tick). A linked
    # transaction is never matched again, so one charge can't tick two plans.
    # Plain nullable columns (no FK) so _sync_missing_columns can add them.
    linked_deadline_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    linked_occurrence = Column(Date, nullable=True)

    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    bank_connection = relationship("BankConnection", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, amount={self.amount}, category={self.category}, source={self.source})>"


# ─── Budget Goal ──────────────────────────────────────────────────────────────


class BudgetGoal(Base):
    """Monthly budget goal for a category."""

    __tablename__ = "budget_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    category = Column(String(100), nullable=False, index=True)
    monthly_limit = Column(Float, nullable=False)
    month = Column(Date, nullable=False)  # First day of the month

    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<BudgetGoal(id={self.id}, category={self.category}, limit={self.monthly_limit})>"


# ─── Category Mapping ─────────────────────────────────────────────────────────

# Default merchant category code → budget category mapping
DEFAULT_CATEGORY_MAP = {
    "5411": "Alimentari",
    "5412": "Alimentari",
    "5541": "Trasporti",
    "5542": "Trasporti",
    "4121": "Trasporti",
    "4131": "Trasporti",
    "5812": "Ristorazione",
    "5814": "Ristorazione",
    "5813": "Ristorazione",
    "7832": "Svago",
    "7922": "Svago",
    "7941": "Svago",
    "5045": "Tech",
    "5732": "Tech",
    "5734": "Tech",
    "5735": "Tech",
    "8011": "Salute",
    "8021": "Salute",
    "8031": "Salute",
    "8042": "Salute",
    "8049": "Salute",
    "8099": "Salute",
    "5912": "Salute",
    "5944": "Shopping",
    "5651": "Shopping",
    "5691": "Shopping",
    "5699": "Shopping",
}
