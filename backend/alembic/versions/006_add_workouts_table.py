"""Add workouts table.

Revision ID: 006_workouts_table
Revises: 005_notification_tables
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "006_workouts_table"
down_revision = "005_notification_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    workout_type_enum = sa.Enum(
        "running", "walking", "cycling", "swimming", "strength",
        "hiit", "yoga", "stretching", "martial_arts", "other",
        name="workouttype",
    )
    workout_type_enum.create(op.get_bind(), checkfirst=True)

    workout_intensity_enum = sa.Enum(
        "low", "moderate", "high", "extreme",
        name="workoutintensity",
    )
    workout_intensity_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "workouts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("workout_type", workout_type_enum, nullable=False, index=True),
        sa.Column("intensity", workout_intensity_enum, nullable=False, server_default="moderate"),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("calories_burned", sa.Integer, nullable=True),
        sa.Column("distance_km", sa.Float, nullable=True),
        sa.Column("avg_heart_rate", sa.Integer, nullable=True),
        sa.Column("max_heart_rate", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("source", sa.String(100), nullable=False, server_default="manual"),
        sa.Column("started_at", sa.DateTime, nullable=False, index=True),
        sa.Column("ended_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True, onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("workouts")
    sa.Enum(name="workouttype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="workoutintensity").drop(op.get_bind(), checkfirst=True)
