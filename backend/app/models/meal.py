"""Meal planning and nutrition tracking model."""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Date, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date
from enum import Enum

from app.core.database import Base


class MealType(str, Enum):
    """Meal type."""

    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class MealPlan(Base):
    """Meal planning and nutrition tracking."""

    __tablename__ = "meal_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    date = Column(Date, nullable=False, index=True)
    meal_type = Column(SQLEnum(MealType), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)

    # Nutrition info
    calories = Column(Integer, nullable=True)
    protein = Column(Float, nullable=True)  # grams
    carbs = Column(Float, nullable=True)  # grams
    fat = Column(Float, nullable=True)  # grams

    notes = Column(String(500), nullable=True)
    is_prepared = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<MealPlan(id={self.id}, name={self.name}, date={self.date})>"
