from datetime import datetime, timezone
from collections import defaultdict
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Club, User
from app.schemas import ClubOut, PasswordChangeIn, TokenOut, UserCreate, UserOut
from app.services.parents import find_user_by_phone

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_login_hits: dict[str, list[float]] = defaultdict(list)


def _rate_limit_login(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = settings.login_rate_window_seconds
    limit = settings.login_rate_limit
    hits = [t for t in _login_hits[ip] if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail="Trop de tentatives de connexion. Réessayez plus tard.")
    hits.append(now)
    _login_hits[ip] = hits


@router.post("/login", response_model=TokenOut)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    _rate_limit_login(request)
    user = db.query(User).filter(User.email == form.username).first()
    if not user:
        user = find_user_by_phone(db, form.username)
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte désactivé")
    token = create_access_token(user.id, {"role": user.role})
    return TokenOut(
        access_token=token,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password")
def change_password(
    payload: PasswordChangeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    if payload.new_password == payload.current_password:
        raise HTTPException(400, "Le nouveau mot de passe doit être différent")
    weak = {"admin123", "coach123", "parent123", "password", "12345678"}
    if payload.new_password.lower() in weak:
        raise HTTPException(400, "Mot de passe trop faible (interdit en production)")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True, "message": "Mot de passe mis à jour"}


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email déjà utilisé")
    if payload.phone and db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(400, "Téléphone déjà utilisé")
    user = User(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        full_name_ar=payload.full_name_ar,
        role=payload.role,
        password_hash=hash_password(payload.password),
        locale=payload.locale,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    return db.query(User).order_by(User.full_name).all()


club_router = APIRouter(prefix="/club", tags=["club"])


@club_router.get("/branding", response_model=ClubOut)
def branding(db: Session = Depends(get_db)):
    club = db.query(Club).first()
    if not club:
        raise HTTPException(404, "Club non configuré")
    return club


system_router = APIRouter(prefix="/system", tags=["system"])
_last_wake: datetime | None = None


@system_router.get("/health")
def health():
    insecure = []
    if settings.secret_key in {"dev-secret-change-me", "change-me", ""}:
        insecure.append("weak_secret_key")
    if settings.default_admin_password in {"admin123", "password", "123456"}:
        insecure.append("default_admin_password_in_config")
    if "*" in settings.cors_origin_list:
        insecure.append("cors_wildcard")
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "time": datetime.now(timezone.utc).isoformat(),
        "last_wake": _last_wake.isoformat() if _last_wake else None,
        "warnings": insecure,
    }


@system_router.post("/wake")
def wake():
    global _last_wake
    _last_wake = datetime.now(timezone.utc)
    return {"status": "awake", "woken_at": _last_wake.isoformat(), "message": "Serveur réveillé"}
