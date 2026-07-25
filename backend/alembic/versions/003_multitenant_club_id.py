"""Multi-tenant: club_id sur toutes les tables métier + champs tenant/abonnement Club

Revision ID: 003_multitenant
Revises: 002_team_coach_sub
Create Date: 2026-07-25

Stratégie : incrémentale et rétrocompatible.
- Ajout des colonnes club_id (nullable) partout.
- Nouveaux champs tenant/white-label/abonnement sur clubs.
- Backfill : club existant (WRBH) => id=1 ; toutes les lignes existantes => club_id=1.
- slug WRBH = 'wrbh'.
On garde club_id NULLABLE pour l'instant (renforcement NOT NULL dans un incrément
ultérieur une fois tous les chemins de création mis à jour).
"""

from alembic import op

revision = "003_multitenant"
down_revision = "002_team_coach_sub"
branch_labels = None
depends_on = None

# Tables métier recevant club_id
_TABLES = [
    "users",
    "categories",
    "teams",
    "team_coaches",
    "athletes",
    "parent_children",
    "emergency_contacts",
    "team_memberships",
    "registrations",
    "attachments",
    "event_exceptions",
    "convocations",
    "attendances",
    "fee_plans",
    "fee_installments",
    "payments",
    "receipts",
    "coach_payrolls",
    "message_threads",
    "messages",
    "notifications",
    "push_tokens",
    "inventory_assignments",
    "audit_logs",
    "media_objects",
]


def upgrade() -> None:
    # 1) Champs tenant / white-label / abonnement sur clubs
    club_cols = [
        "ADD COLUMN IF NOT EXISTS slug VARCHAR(60)",
        "ADD COLUMN IF NOT EXISTS favicon_path VARCHAR(255)",
        "ADD COLUMN IF NOT EXISTS app_name VARCHAR(120)",
        "ADD COLUMN IF NOT EXISTS locale_default VARCHAR(10) DEFAULT 'fr'",
        "ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Africa/Algiers'",
        "ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'DZD'",
        "ADD COLUMN IF NOT EXISTS sport VARCHAR(40) DEFAULT 'football'",
        "ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
        "ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'club'",
        "ADD COLUMN IF NOT EXISTS trial_ends_on DATE",
        "ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT false",
    ]
    for col in club_cols:
        op.execute(f"ALTER TABLE clubs {col}")

    # 2) club_id nullable sur chaque table métier
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS club_id INTEGER")

    # 3) Backfill : rattacher tout l'existant au club WRBH (id le plus ancien)
    op.execute(
        """
        UPDATE clubs
        SET slug = COALESCE(slug, 'wrbh'),
            status = COALESCE(status, 'active'),
            plan = COALESCE(plan, 'club'),
            locale_default = COALESCE(locale_default, 'fr'),
            currency = COALESCE(currency, 'DZD'),
            timezone = COALESCE(timezone, 'Africa/Algiers'),
            sport = COALESCE(sport, 'football')
        WHERE id = (SELECT MIN(id) FROM clubs)
        """
    )
    for table in _TABLES:
        op.execute(
            f"UPDATE {table} SET club_id = (SELECT MIN(id) FROM clubs) WHERE club_id IS NULL"
        )

    # 4) Index sur club_id (perf / DoD #6)
    for table in _TABLES:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_club_id ON {table} (club_id)"
        )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_clubs_slug ON clubs (slug)")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"DROP INDEX IF EXISTS ix_{table}_club_id")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS club_id")
    op.execute("DROP INDEX IF EXISTS uq_clubs_slug")
    for col in [
        "slug",
        "favicon_path",
        "app_name",
        "locale_default",
        "timezone",
        "currency",
        "sport",
        "status",
        "plan",
        "trial_ends_on",
        "is_platform",
    ]:
        op.execute(f"ALTER TABLE clubs DROP COLUMN IF EXISTS {col}")
