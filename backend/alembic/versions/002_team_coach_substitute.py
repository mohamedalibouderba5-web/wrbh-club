"""Team coach management + event substitute coach

Revision ID: 002_team_coach_sub
Revises: 001_m1_security
Create Date: 2026-07-25
"""

from alembic import op

revision = "002_team_coach_sub"
down_revision = "001_m1_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS substitute_coach_id INTEGER")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_team_coaches_team_id ON team_coaches (team_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_team_coaches_user_id ON team_coaches (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_team_coaches_user_id")
    op.execute("DROP INDEX IF EXISTS ix_team_coaches_team_id")
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS substitute_coach_id")
