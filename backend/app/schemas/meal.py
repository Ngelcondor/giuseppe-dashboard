"""Meal planning schemas."""
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict
import uuid
from app.models.meal import MealType


class MealPlanBase(BaseModel):
    """Base meal plan schema."""

    date: date
    meal_type: MealType
    name: str
    description: Optional[str] = None
    calories: Optional[int] = Field(None, ge=0)
    protein: Optional[float] = Field(None, ge=0)  # grams
    carbs: Optional[float] = Field(None, ge=0)  # grams
    fat: Optional[float] = Field(None, ge=0)  # grams
    notes: Optional[str] = None
    is_prepared: bool = False


class MealPlanCreate(MealPlanBase):
    """Meal plan creation schema."""

    pass


class MealPlanUpdate(BaseModel):
    """Meal plan update schema."""

    name: Optional[str] = None
    description: Optional[str] = None
    calories: Optional[int] = Field(None, ge=0)
    protein: Optional[float] = Field(None, ge=0)
    carbs: Optional[float] = Field(None, ge=0)
    fat: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    is_prepared: Optional[bool] = None


class MealPlanResponse(MealPlanBase):
    """Meal plan response schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MealWeekResponse(BaseModel):
    """Weekly meal plan response."""

    week_start: date
    week_end: date
    breakfasts: List[MealPlanResponse]
    lunches: List[MealPlanResponse]
    dinners: List[MealPlanResponse]
    snacks: List[MealPlanResponse]


class MealNutritionSummary(BaseModel):
    """Daily nutrition summary."""

    date: date
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fat: float
    meals: List[MealPlanResponse]


class MealNutritionWeeklyResponse(BaseModel):
    """Weekly nutrition summary."""

    week_start: date
    week_end: date
    daily_summaries: List[MealNutritionSummary]
    weekly_average_calories: float
    weekly_average_protein: float
    weekly_average_carbs: float
    weekly_average_fat: float
