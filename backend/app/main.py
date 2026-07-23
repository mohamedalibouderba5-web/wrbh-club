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


def _ensure_schema() -> None:
    """Add columns create_all cannot alter on existing Postgres tables."""
    stmts = [
        "ALTER TABLE athletes ADD COLUMN IF NOT EXISTS blood_type VARCHAR(8)",
        "CREATE INDEX IF NOT EXISTS ix_athletes_full_name ON athletes (full_name)",
        "CREATE INDEX IF NOT EXISTS ix_athletes_status ON athletes (status)",
        "CREATE INDEX IF NOT EXISTS ix_athletes_birth_date ON athletes (birth_date)",
        "CREATE INDEX IF NOT EXISTS ix_parent_children_athlete ON parent_children (athlete_id)",
        "CREATE INDEX IF NOT EXISTS ix_registrations_athlete_season ON registrations (athlete_id, season_id)",
        "CREATE INDEX IF NOT EXISTS ix_emergency_contacts_athlete ON emergency_contacts (athlete_id)",
    ]
    with engine.begin() as conn:
        for sql in stmts:
            try:
                conn.execute(text(sql))
            except Exception:
                if "ADD COLUMN" in sql and "blood_type" in sql:
                    try:
                        conn.execute(text("ALTER TABLE athletes ADD COLUMN blood_type VARCHAR(8)"))
                    except Exception:
                        pass


if settings.sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.1)
    except Exception:
        pass

app = FastAPI(
    title=settings.app_name,
    version="1.4.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    default_response_class=ORJSONResponse,
)

# Origines web connues (prod) — toujours autorisées même si CORS_ORIGINS est mal configuré sur Render
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in cors_origins if o != "*"] or ["*"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _ensure_schema()


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
    return {
        "app": settings.app_name,
        "club": settings.club_name,
        "club_ar": settings.club_name_ar,
        "docs": "/api/docs",
        "health": "/health",
        "wake": "POST /api/v1/system/wake",
    }
