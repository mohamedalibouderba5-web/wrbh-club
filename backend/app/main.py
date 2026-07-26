from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import agenda, auth, club, finance, mobile, uploads
from app.core.config import get_settings
from app.core.database import Base, engine

settings = get_settings()

_WEAK_SECRETS = {"dev-secret-change-me", "change-me", "secret", ""}
_WEAK_ADMIN_PWDS = {"admin123", "password", "123456", "coach123"}


def _assert_production_secrets() -> None:
    """Refuse de démarrer en production avec SECRET_KEY faible (DoD commercial)."""
    if not settings.is_production:
        return
    if settings.secret_key.strip() in _WEAK_SECRETS or len(settings.secret_key) < 24:
        raise RuntimeError(
            "SECRET_KEY trop faible pour la production. "
            "Définir une clé aléatoire >= 24 caractères via variable d'environnement."
        )
    # DEFAULT_ADMIN_PASSWORD faible → warning health (ne bloque pas le boot si le hash DB est déjà rotaté)


# Tables métier recevant club_id (doit refléter alembic 003)
_TENANT_TABLES = [
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


def _ensure_schema() -> None:
    """Compat legacy + tenant : colonnes/index idempotents (Render ne lance pas Alembic
    au déploiement). Alembic reste la source de vérité pour une base neuve."""
    stmts = [
        "ALTER TABLE athletes ADD COLUMN IF NOT EXISTS blood_type VARCHAR(8)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false",
        "ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(12, 2) DEFAULT 0",
        "CREATE INDEX IF NOT EXISTS ix_athletes_full_name ON athletes (full_name)",
        "CREATE INDEX IF NOT EXISTS ix_athletes_status ON athletes (status)",
        "CREATE INDEX IF NOT EXISTS ix_athletes_birth_date ON athletes (birth_date)",
        "CREATE INDEX IF NOT EXISTS ix_parent_children_athlete ON parent_children (athlete_id)",
        "CREATE INDEX IF NOT EXISTS ix_registrations_athlete_season ON registrations (athlete_id, season_id)",
        "CREATE INDEX IF NOT EXISTS ix_emergency_contacts_athlete ON emergency_contacts (athlete_id)",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS substitute_coach_id INTEGER",
        # --- Multi-tenant (alembic 003) : champs Club ---
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS slug VARCHAR(60)",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS favicon_path VARCHAR(255)",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS app_name VARCHAR(120)",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS locale_default VARCHAR(10) DEFAULT 'fr'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Africa/Algiers'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'DZD'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS sport VARCHAR(40) DEFAULT 'football'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'club'",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS trial_ends_on DATE",
        "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT false",
        # --- Références immuables (inscriptions / finance) ---
        "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seq_no INTEGER",
        "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reference VARCHAR(60)",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS seq_no INTEGER",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference VARCHAR(80)",
        "ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS seq_no INTEGER",
        "ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(80)",
        "ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS seq_no INTEGER",
        "ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS reference VARCHAR(80)",
        "CREATE INDEX IF NOT EXISTS ix_registrations_seq_no ON registrations (seq_no)",
        "CREATE INDEX IF NOT EXISTS ix_registrations_reference ON registrations (reference)",
        "CREATE INDEX IF NOT EXISTS ix_payments_reference ON payments (reference)",
    ]
    # club_id sur chaque table métier + index
    for _t in _TENANT_TABLES:
        stmts.append(f"ALTER TABLE {_t} ADD COLUMN IF NOT EXISTS club_id INTEGER")
        stmts.append(f"CREATE INDEX IF NOT EXISTS ix_{_t}_club_id ON {_t} (club_id)")
    with engine.begin() as conn:
        for sql in stmts:
            try:
                conn.execute(text(sql))
            except Exception:
                if "blood_type" in sql:
                    try:
                        conn.execute(text("ALTER TABLE athletes ADD COLUMN blood_type VARCHAR(8)"))
                    except Exception:
                        pass
                if "must_change_password" in sql:
                    try:
                        conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT false"))
                    except Exception:
                        pass
        # Unique athlete+season : dédoublonne puis crée l'index (idempotent)
        try:
            conn.execute(
                text(
                    """
                    DELETE FROM registrations a
                    USING registrations b
                    WHERE a.id > b.id
                      AND a.athlete_id = b.athlete_id
                      AND a.season_id = b.season_id
                    """
                )
            )
        except Exception:
            pass
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_athlete_season "
                    "ON registrations (athlete_id, season_id)"
                )
            )
        except Exception:
            pass
        # --- Tenant backfill : rattacher tout l'existant au club le plus ancien (WRBH=1) ---
        try:
            conn.execute(
                text(
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
            )
        except Exception:
            pass
        for _t in _TENANT_TABLES:
            try:
                conn.execute(
                    text(
                        f"UPDATE {_t} SET club_id = (SELECT MIN(id) FROM clubs) "
                        f"WHERE club_id IS NULL"
                    )
                )
            except Exception:
                pass
        try:
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS uq_clubs_slug ON clubs (slug)")
            )
        except Exception:
            pass


_assert_production_secrets()

if settings.sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.1)
    except Exception:
        pass

_docs = None if settings.is_production else "/api/docs"
_redoc = None if settings.is_production else "/api/redoc"
_openapi = None if settings.is_production else "/api/openapi.json"

app = FastAPI(
    title=settings.app_name,
    version="1.10.0",
    docs_url=_docs,
    redoc_url=_redoc,
    openapi_url=_openapi,
    default_response_class=ORJSONResponse,
)

# Origines web exactes (pas de regex *.onrender.com en prod)
KNOWN_WEB_ORIGINS = (
    "https://wrbh-web.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)

cors_origins = list({*settings.cors_origin_list, *KNOWN_WEB_ORIGINS})
if not settings.is_production:
    cors_origins = list({*cors_origins, "*"})

app.add_middleware(GZipMiddleware, minimum_size=500)
_cors_kwargs: dict = {
    "allow_origins": [o for o in cors_origins if o != "*"] or ["*"],
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "expose_headers": ["*"],
}
if not settings.is_production:
    _cors_kwargs["allow_origin_regex"] = r"https://.*\.onrender\.com"
app.add_middleware(CORSMiddleware, **_cors_kwargs)

upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
# Disque local uniquement hors prod (éphémère + public sur Render)
if not settings.is_production:
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _ensure_schema()
    try:
        from app.core.database import SessionLocal
        from app.services.references import backfill_operation_identities, backfill_registration_identities

        db = SessionLocal()
        try:
            backfill_registration_identities(db)
            backfill_operation_identities(db)
        finally:
            db.close()
    except Exception:
        pass


@app.get("/health")
def root_health():
    return auth.health()


app.include_router(auth.router, prefix="/api/v1")
app.include_router(auth.club_router, prefix="/api/v1")
app.include_router(auth.system_router, prefix="/api/v1")
app.include_router(club.router, prefix="/api/v1")
app.include_router(club.athletes_router, prefix="/api/v1")
app.include_router(club.reg_router, prefix="/api/v1")
app.include_router(agenda.router, prefix="/api/v1")
app.include_router(agenda.comms_router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(finance.inv_router, prefix="/api/v1")
app.include_router(mobile.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")


@app.get("/")
def root():
    payload = {
        "app": settings.app_name,
        "club": settings.club_name,
        "club_ar": settings.club_name_ar,
        "health": "/health",
        "wake": "POST /api/v1/system/wake",
    }
    if not settings.is_production:
        payload["docs"] = "/api/docs"
    return payload
