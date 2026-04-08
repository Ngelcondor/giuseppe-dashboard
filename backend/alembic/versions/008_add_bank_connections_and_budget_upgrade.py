"""Add bank_connections table and upgrade transactions for GoCardless + CSV import.

Revision ID: 008
Revises: 007
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "008_bank_connections_budget"
down_revision = "007_sleep_cycle_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Create bank_connections table ─────────────────────────────────────────
    op.create_table(
        "bank_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("requisition_id", sa.String(255), nullable=True, unique=True),
        sa.Column("agreement_id", sa.String(255), nullable=True),
        sa.Column("institution_id", sa.String(100), nullable=False),
        sa.Column("institution_name", sa.String(255), nullable=False, server_default="Revolut"),
        sa.Column("account_id", sa.String(255), nullable=True, index=True),
        sa.Column("account_iban", sa.String(50), nullable=True),
        sa.Column("account_name", sa.String(255), nullable=True),
        sa.Column("currency", sa.String(10), server_default="EUR"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("last_sync_at", sa.DateTime, nullable=True),
        sa.Column("last_sync_error", sa.Text, nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    # ── Add new columns to transactions ───────────────────────────────────────
    op.add_column("transactions", sa.Column("source", sa.String(20), server_default="manual"))
    op.add_column("transactions", sa.Column("external_id", sa.String(255), nullable=True, unique=True))
    op.add_column("transactions", sa.Column("bank_connection_id", UUID(as_uuid=True), nullable=True))
    op.add_column("transactions", sa.Column("merchant_name", sa.String(255), nullable=True))
    op.add_column("transactions", sa.Column("merchant_category_code", sa.String(10), nullable=True))
    op.add_column("transactions", sa.Column("bank_category", sa.String(100), nullable=True))
    op.add_column("transactions", sa.Column("raw_description", sa.Text, nullable=True))
    op.add_column("transactions", sa.Column("linked_scadenza_id", UUID(as_uuid=True), nullable=True))

    # Add indexes
    op.create_index("ix_transactions_external_id", "transactions", ["external_id"])
    op.create_index("ix_transactions_linked_scadenza_id", "transactions", ["linked_scadenza_id"])

    # Add foreign keys
    op.create_foreign_key(
        "fk_transactions_bank_connection",
        "transactions",
        "bank_connections",
        ["bank_connection_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_transactions_scadenza",
        "transactions",
        "scadenze",
        ["linked_scadenza_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_scadenza", "transactions", type_="foreignkey")
    op.drop_constraint("fk_transactions_bank_connection", "transactions", type_="foreignkey")
    op.drop_index("ix_transactions_linked_scadenza_id", "transactions")
    op.drop_index("ix_transactions_external_id", "transactions")
    op.drop_column("transactions", "linked_scadenza_id")
    op.drop_column("transactions", "raw_description")
    op.drop_column("transactions", "bank_category")
    op.drop_column("transactions", "merchant_category_code")
    op.drop_column("transactions", "merchant_name")
    op.drop_column("transactions", "bank_connection_id")
    op.drop_column("transactions", "external_id")
    op.drop_column("transactions", "source")
    op.drop_table("bank_connections")
