"""Budget and finance tracking models."""
from sqlalchemy import Column, String, Float, DateTime, Boolean, Date, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date
from enum import Enum

from app.core.database import Base


class TransactionType(str, Enum):
    """Transaction type."""

    INCOME = "income"
    EXPENSE = "expense"


class RecurringFrequency(str, Enum):
    """Recurring frequency."""

    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


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

    # Recurring transaction
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(
        SQLEnum(RecurringFrequency), nullable=True
    )
    recurring_end_date = Column(Date, nullable=True)

    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, amount={self.amount}, category={self.category})>"


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
