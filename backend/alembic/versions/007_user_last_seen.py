"""users.last_seen_at — présence plateforme

Revision ID: 007
Revises: 006_club_seq_counters
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa

revision = "007_user_last_seen"
down_revision = "006_club_seq_counters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_last_seen_at", "users", ["last_seen_at"])


def downgrade() -> None:
    op.drop_index("ix_users_last_seen_at", table_name="users")
    op.drop_column("users", "last_seen_at")
