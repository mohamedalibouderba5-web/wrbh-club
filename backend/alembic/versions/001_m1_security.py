"""M1 security: unique registration athlete+season + insurance_amount

Revision ID: 001_m1_security
Revises:
Create Date: 2026-07-25
"""

from alembic import op
import sqlalchemy as sa

revision = "001_m1_security"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Colonnes legacy (idempotent)
    op.execute("ALTER TABLE athletes ADD COLUMN IF NOT EXISTS blood_type VARCHAR(8)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false")
    op.execute("ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(12, 2) DEFAULT 0")

    # Dédoublonnage avant unique
    op.execute(
        """
        DELETE FROM registrations a
        USING registrations b
        WHERE a.id > b.id
          AND a.athlete_id = b.athlete_id
          AND a.season_id = b.season_id
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_athlete_season ON registrations (athlete_id, season_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_reg_athlete_season")
