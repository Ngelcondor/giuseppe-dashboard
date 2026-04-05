"""Add scheduled_time, is_prn, color, icon to medications.

Revision ID: 003_medication_fields
Revises: 002_calendar_connections
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "003_medication_fields"
down_revision = "002_calendar_connections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("medications", sa.Column("scheduled_time", sa.String(10), nullable=True))
    op.add_column("medications", sa.Column("is_prn", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("medications", sa.Column("color", sa.String(20), nullable=True))
    op.add_column("medications", sa.Column("icon", sa.String(10), nullable=True))
    op.create_index("ix_medications_is_prn", "medications", ["is_prn"])


def downgrade() -> None:
    op.drop_index("ix_medications_is_prn", table_name="medications")
    op.drop_column("medications", "icon")
    op.drop_column("medications", "color")
    op.drop_column("medications", "is_prn")
    op.drop_column("medications", "scheduled_time")
