"""Budget and transaction endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, datetime, timedelta
from typing import List
from calendar import monthrange

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.budget import Transaction, BudgetGoal
from app.schemas.budget import (
    TransactionCreate, TransactionResponse, TransactionUpdate,
    BudgetGoalCreate, BudgetGoalResponse, BudgetGoalUpdate,
    BudgetSummary, BudgetTrends,
)

router = APIRouter(prefix="/budget", tags=["budget"])


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Create a transaction."""
    txn = Transaction(
        user_id=current_user["sub"],
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
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TransactionResponse]:
    """List transactions."""
    query = select(Transaction).where(Transaction.user_id == current_user["sub"])

    if month and year:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        query = query.where((Transaction.date >= start) & (Transaction.date <= end))

    result = await db.execute(query.order_by(Transaction.date.desc()))
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return TransactionResponse.from_orm(transaction)


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    transaction_update: TransactionUpdate,
    current_user: dict = Depends(get_current_user),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    update_data = transaction_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(transaction, field, value)

    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return TransactionResponse.from_orm(transaction)


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await db.delete(transaction)
    await db.commit()


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

    income = sum(t.amount for t in transactions if t.transaction_type.value == "income")
    expenses = sum(t.amount for t in transactions if t.transaction_type.value == "expense")
    balance = income - expenses

    by_category = {}
    for txn in transactions:
        if txn.transaction_type.value == "expense":
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
        end = date(current_month.year, current_month.month, monthrange(current_month.year, current_month.month)[1])

        result = await db.execute(
            select(Transaction).where(
                (Transaction.user_id == current_user["sub"])
                & (Transaction.date >= start)
                & (Transaction.date <= end)
            )
        )
        transactions = result.scalars().all()

        income = sum(t.amount for t in transactions if t.transaction_type.value == "income")
        expenses = sum(t.amount for t in transactions if t.transaction_type.value == "expense")

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


# Budget Goals
@router.post("/goals", response_model=BudgetGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_budget_goal(
    goal: BudgetGoalCreate,
    current_user: dict = Depends(get_current_user),
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
