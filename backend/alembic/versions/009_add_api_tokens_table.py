"""Add api_tokens table.

Revision ID: 009
Revises: 008
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("token_prefix", sa.String(8), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False, server_default="webhook"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("api_tokens")
