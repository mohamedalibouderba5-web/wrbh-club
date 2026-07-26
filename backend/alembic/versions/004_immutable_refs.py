"""Références immuables inscriptions + opérations finance

Revision ID: 004_immutable_refs
Revises: 003_multitenant
Create Date: 2026-07-25
"""

from alembic import op

revision = "004_immutable_refs"
down_revision = "003_multitenant"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seq_no INTEGER")
    op.execute("ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reference VARCHAR(60)")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS seq_no INTEGER")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference VARCHAR(80)")
    op.execute("ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS seq_no INTEGER")
    op.execute("ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(80)")
    op.execute("ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS seq_no INTEGER")
    op.execute("ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS reference VARCHAR(80)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_registrations_seq_no ON registrations (seq_no)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_registrations_reference ON registrations (reference)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_registrations_reference")
    op.execute("DROP INDEX IF EXISTS ix_registrations_seq_no")
    for table, cols in [
        ("registrations", ["seq_no", "reference"]),
        ("payments", ["seq_no", "reference"]),
        ("ledger_entries", ["seq_no", "reference"]),
        ("fee_installments", ["seq_no", "reference"]),
    ]:
        for col in cols:
            op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {col}")
