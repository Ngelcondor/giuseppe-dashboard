"""Add calendar_connections table for CalDAV sync.

Revision ID: 002_calendar_connections
Revises: 001
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "002_calendar_connections"
down_revision = None  # Adjust to actual previous revision ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("caldav_url", sa.String(500), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("app_password", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("last_sync_at", sa.DateTime, nullable=True),
        sa.Column("last_sync_status", sa.String(50), nullable=True),
        sa.Column("last_sync_error", sa.Text, nullable=True),
        sa.Column("sync_interval_minutes", sa.String(10), default="15"),
        sa.Column("calendars_filter", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("calendar_connections")
