"""Meal planning endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date, timedelta
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.meal import MealPlan
from app.schemas.meal import (
    MealPlanCreate, MealPlanResponse, MealPlanUpdate,
    MealWeekResponse, MealNutritionSummary, MealNutritionWeeklyResponse,
)

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_meal_plan(
    meal: MealPlanCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> MealPlanResponse:
    """Create a meal plan."""
    meal_plan = MealPlan(
        user_id=current_user["sub"],
        **meal.dict(),
    )
    db.add(meal_plan)
    await db.commit()
    await db.refresh(meal_plan)
    return MealPlanResponse.from_orm(meal_plan)


@router.get("", response_model=List[MealPlanResponse])
async def list_meal_plans(
    day: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MealPlanResponse]:
    """List meal plans."""
    query = select(MealPlan).where(MealPlan.user_id == current_user["sub"])

    if day:
        query = query.where(MealPlan.date == day)

    result = await db.execute(query.order_by(MealPlan.date))
    meals = result.scalars().all()
    return [MealPlanResponse.from_orm(m) for m in meals]


@router.get("/{meal_id}", response_model=MealPlanResponse)
async def get_meal_plan(
    meal_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MealPlanResponse:
    """Get a specific meal plan."""
    result = await db.execute(
        select(MealPlan).where(
            (MealPlan.id == meal_id)
            & (MealPlan.user_id == current_user["sub"])
        )
    )
    meal = result.scalars().first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")
    return MealPlanResponse.from_orm(meal)


@router.put("/{meal_id}", response_model=MealPlanResponse)
async def update_meal_plan(
    meal_id: str,
    meal_update: MealPlanUpdate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> MealPlanResponse:
    """Update a meal plan."""
    result = await db.execute(
        select(MealPlan).where(
            (MealPlan.id == meal_id)
            & (MealPlan.user_id == current_user["sub"])
        )
    )
    meal = result.scalars().first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")

    update_data = meal_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(meal, field, value)

    db.add(meal)
    await db.commit()
    await db.refresh(meal)
    return MealPlanResponse.from_orm(meal)


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal_plan(
    meal_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a meal plan."""
    result = await db.execute(
        select(MealPlan).where(
            (MealPlan.id == meal_id)
            & (MealPlan.user_id == current_user["sub"])
        )
    )
    meal = result.scalars().first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")

    await db.delete(meal)
    await db.commit()


@router.get("/week/all", response_model=MealWeekResponse)
async def get_week_meals(
    start_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MealWeekResponse:
    """Get meal plan for a week."""
    if not start_date:
        start_date = date.today()

    # Make start_date the beginning of the week (Monday)
    start_date = start_date - timedelta(days=start_date.weekday())
    end_date = start_date + timedelta(days=6)

    result = await db.execute(
        select(MealPlan).where(
            (MealPlan.user_id == current_user["sub"])
            & (MealPlan.date >= start_date)
            & (MealPlan.date <= end_date)
        )
    )
    meals = result.scalars().all()

    breakfasts = [m for m in meals if m.meal_type.value == "breakfast"]
    lunches = [m for m in meals if m.meal_type.value == "lunch"]
    dinners = [m for m in meals if m.meal_type.value == "dinner"]
    snacks = [m for m in meals if m.meal_type.value == "snack"]

    return MealWeekResponse(
        week_start=start_date,
        week_end=end_date,
        breakfasts=[MealPlanResponse.from_orm(m) for m in breakfasts],
        lunches=[MealPlanResponse.from_orm(m) for m in lunches],
        dinners=[MealPlanResponse.from_orm(m) for m in dinners],
        snacks=[MealPlanResponse.from_orm(m) for m in snacks],
    )


@router.get("/nutrition/summary", response_model=MealNutritionWeeklyResponse)
async def get_nutrition_summary(
    start_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MealNutritionWeeklyResponse:
    """Get weekly nutrition summary."""
    if not start_date:
        start_date = date.today()

    # Make start_date the beginning of the week (Monday)
    start_date = start_date - timedelta(days=start_date.weekday())
    end_date = start_date + timedelta(days=6)

    result = await db.execute(
        select(MealPlan).where(
            (MealPlan.user_id == current_user["sub"])
            & (MealPlan.date >= start_date)
            & (MealPlan.date <= end_date)
        )
    )
    meals = result.scalars().all()

    daily_summaries = []
    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0

    current_date = start_date
    while current_date <= end_date:
        day_meals = [m for m in meals if m.date == current_date]

        calories = sum(m.calories or 0 for m in day_meals)
        protein = sum(m.protein or 0 for m in day_meals)
        carbs = sum(m.carbs or 0 for m in day_meals)
        fat = sum(m.fat or 0 for m in day_meals)

        daily_summaries.append(
            MealNutritionSummary(
                date=current_date,
                total_calories=calories,
                total_protein=protein,
                total_carbs=carbs,
                total_fat=fat,
                meals=[MealPlanResponse.from_orm(m) for m in day_meals],
            )
        )

        total_calories += calories
        total_protein += protein
        total_carbs += carbs
        total_fat += fat

        current_date += timedelta(days=1)

    days_count = 7
    return MealNutritionWeeklyResponse(
        week_start=start_date,
        week_end=end_date,
        daily_summaries=daily_summaries,
        weekly_average_calories=total_calories / days_count,
        weekly_average_protein=total_protein / days_count,
        weekly_average_carbs=total_carbs / days_count,
        weekly_average_fat=total_fat / days_count,
    )
