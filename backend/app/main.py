from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import agenda, auth, club, finance, mobile, uploads
from app.core.config import get_settings
from app.core.database import Base, engine

settings = get_settings()

if settings.sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.1)
    except Exception:
        pass

app = FastAPI(title=settings.app_name, version="1.2.0", docs_url="/api/docs", redoc_url="/api/redoc")

cors_origins = list(settings.cors_origin_list)
if not settings.is_production:
    cors_origins = list({*cors_origins, "*"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


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
