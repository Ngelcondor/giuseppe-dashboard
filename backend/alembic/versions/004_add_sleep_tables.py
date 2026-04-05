"""Add sleep_sessions and sleep_phases tables.

Revision ID: 004_sleep_tables
Revises: 003_medication_fields
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "004_sleep_tables"
down_revision = "003_medication_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sleep_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("sleep_start", sa.DateTime, nullable=False, index=True),
        sa.Column("sleep_end", sa.DateTime, nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("quality_score", sa.Integer, nullable=True),
        sa.Column("time_in_bed_minutes", sa.Integer, nullable=True),
        sa.Column("sleep_efficiency", sa.Float, nullable=True),
        sa.Column("awake_minutes", sa.Integer, server_default="0"),
        sa.Column("light_minutes", sa.Integer, server_default="0"),
        sa.Column("deep_minutes", sa.Integer, server_default="0"),
        sa.Column("rem_minutes", sa.Integer, server_default="0"),
        sa.Column("source", sa.String(100), nullable=False, server_default="manual"),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("mood_on_wake", sa.String(50), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True, onupdate=sa.func.now()),
    )

    sleep_phase_enum = sa.Enum("awake", "light", "deep", "rem", name="sleepphase")
    sleep_phase_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "sleep_phases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sleep_sessions.id"), nullable=False, index=True),
        sa.Column("phase", sleep_phase_enum, nullable=False),
        sa.Column("start_time", sa.DateTime, nullable=False),
        sa.Column("end_time", sa.DateTime, nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sleep_phases")
    op.drop_table("sleep_sessions")
    sa.Enum(name="sleepphase").drop(op.get_bind(), checkfirst=True)
