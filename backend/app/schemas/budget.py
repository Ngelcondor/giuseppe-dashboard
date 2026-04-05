"""Budget and transaction schemas."""
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict
import uuid
from app.models.budget import TransactionType, RecurringFrequency


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


class TransactionResponse(TransactionBase):
    """Transaction response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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


class BudgetSummary(BaseModel):
    """Budget summary for a month."""

    month: date
    income: float
    expenses: float
    balance: float
    by_category: Dict[str, float]
    goals: Dict[str, Dict[str, float]]  # category -> {limit, spent, remaining}


class BudgetTrends(BaseModel):
    """Budget trends over time."""

    period: str  # "3months", "6months", "1year"
    months: List[date]
    monthly_income: List[float]
    monthly_expenses: List[float]
    monthly_balance: List[float]
