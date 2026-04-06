"""Add Sleep Cycle specific fields to sleep_sessions.

Revision ID: 007_sleep_cycle_fields
Revises: 006_workouts_table
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "007_sleep_cycle_fields"
down_revision = "006_workouts_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sleep_sessions", sa.Column("sc_quality_score", sa.Integer(), nullable=True))
    op.add_column("sleep_sessions", sa.Column("snoring_minutes", sa.Integer(), nullable=True))
    op.add_column("sleep_sessions", sa.Column("snoring_pct", sa.Float(), nullable=True))
    op.add_column("sleep_sessions", sa.Column("regularity_score", sa.Integer(), nullable=True))
    op.add_column("sleep_sessions", sa.Column("sleep_aid_used", sa.String(100), nullable=True))
    op.add_column("sleep_sessions", sa.Column("alarm_mode", sa.String(50), nullable=True))
    op.add_column("sleep_sessions", sa.Column("wake_up_mood", sa.String(50), nullable=True))
    op.add_column("sleep_sessions", sa.Column("heart_rate_lowest", sa.Integer(), nullable=True))
    op.add_column("sleep_sessions", sa.Column("steps_to_sleep", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("sleep_sessions", "steps_to_sleep")
    op.drop_column("sleep_sessions", "heart_rate_lowest")
    op.drop_column("sleep_sessions", "wake_up_mood")
    op.drop_column("sleep_sessions", "alarm_mode")
    op.drop_column("sleep_sessions", "sleep_aid_used")
    op.drop_column("sleep_sessions", "regularity_score")
    op.drop_column("sleep_sessions", "snoring_pct")
    op.drop_column("sleep_sessions", "snoring_minutes")
    op.drop_column("sleep_sessions", "sc_quality_score")
