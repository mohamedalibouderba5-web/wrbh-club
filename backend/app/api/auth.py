from datetime import datetime, timezone
from collections import defaultdict
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Athlete, Club, ParentChild, Registration, User
from app.schemas import ClubOut, PasswordChangeIn, TokenOut, UserCreate, UserOut, UserUpdate
from app.services.parents import find_user_by_phone

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_login_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_limit_login(request: Request, username: str) -> None:
    ip = _client_ip(request)
    now = time.time()
    window = settings.login_rate_window_seconds
    limit = settings.login_rate_limit
    keys = [f"ip:{ip}", f"user:{(username or '').strip().lower()}:{ip}"]
    for key in keys:
        hits = [t for t in _login_hits[key] if now - t < window]
        if len(hits) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Trop de tentatives de connexion. Réessayez plus tard.",
            )
        hits.append(now)
        _login_hits[key] = hits


@router.post("/login", response_model=TokenOut)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    _rate_limit_login(request, form.username)
    user = db.query(User).filter(User.email == form.username).first()
    if not user:
        user = find_user_by_phone(db, form.username)
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte désactivé")
    token = create_access_token(
        user.id, {"role": user.role, "club_id": getattr(user, "club_id", None)}
    )
    return TokenOut(
        access_token=token,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        club_id=getattr(user, "club_id", None),
        must_change_password=bool(getattr(user, "must_change_password", False)),
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
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Mot de passe trop court (min. 8 caractères)")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    from app.services.audit import write_audit

    write_audit(db, action="change_password", entity="user", entity_id=user.id, user_id=user.id)
    db.commit()
    return {"ok": True, "message": "Mot de passe mis à jour"}


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    try:
        role = Role(payload.role)
    except ValueError as exc:
        raise HTTPException(400, f"Rôle invalide: {payload.role}") from exc
    if role == Role.ADMIN and actor.role != Role.ADMIN:
        raise HTTPException(403, "Seul un admin peut créer un compte admin")
    if role == Role.SUPERADMIN:
        raise HTTPException(403, "Le super-admin ne se crée pas depuis un club")
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email déjà utilisé")
    if payload.phone and db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(400, "Téléphone déjà utilisé")
    user = User(
        club_id=getattr(actor, "club_id", None),
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        full_name_ar=payload.full_name_ar,
        role=str(role),
        password_hash=hash_password(payload.password),
        locale=payload.locale,
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    from app.services.audit import write_audit

    write_audit(
        db,
        action="create",
        entity="user",
        entity_id=user.id,
        user_id=actor.id,
        detail=f"role={role} name={payload.full_name}",
    )
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    q = db.query(User)
    club_id = getattr(actor, "club_id", None)
    if club_id:
        q = q.filter(or_(User.club_id == club_id, User.club_id.is_(None)))
    return q.order_by(User.full_name).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    actor_club = getattr(actor, "club_id", None)
    target_club = getattr(target, "club_id", None)
    if actor_club and target_club not in (None, actor_club):
        raise HTTPException(404, "Utilisateur introuvable")
    if target.role == Role.SUPERADMIN:
        raise HTTPException(403, "Impossible de modifier un super-admin")
    if target.role == Role.ADMIN and actor.role != Role.ADMIN:
        raise HTTPException(403, "Seul un admin peut modifier un compte admin")

    data = payload.model_dump(exclude_unset=True)
    new_password = data.pop("password", None)
    if "email" in data and data["email"]:
        other = db.query(User).filter(User.email == data["email"], User.id != user_id).first()
        if other:
            raise HTTPException(400, "Email déjà utilisé")
    if "phone" in data and data["phone"]:
        other = db.query(User).filter(User.phone == data["phone"], User.id != user_id).first()
        if other:
            raise HTTPException(400, "Téléphone déjà utilisé")
    for key, value in data.items():
        setattr(target, key, value)
    if new_password:
        target.password_hash = hash_password(new_password)
        target.must_change_password = True
    from app.services.audit import write_audit

    write_audit(
        db,
        action="update",
        entity="user",
        entity_id=target.id,
        user_id=actor.id,
        club_id=actor_club,
        detail=f"role={target.role} name={target.full_name} active={target.is_active}",
    )
    db.commit()
    db.refresh(target)
    return target


club_router = APIRouter(prefix="/club", tags=["club"])


@club_router.get("/branding", response_model=ClubOut)
def branding(slug: str | None = None, db: Session = Depends(get_db)):
    """Branding public. Phase 1 multi-club : sélection par slug à la connexion.
    Sans slug → premier club (compat mono-club WRBH)."""
    club = None
    if slug:
        club = db.query(Club).filter(Club.slug == slug.strip().lower()).first()
        if not club:
            raise HTTPException(404, "Club introuvable")
    else:
        club = db.query(Club).order_by(Club.id).first()
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
        "version": "1.15.0",
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


@system_router.post("/cleanup-audit")
def cleanup_audit(
    confirm: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Purge données marquées [AUDIT] / [TEST] créées par les audits."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    if settings.is_production and not settings.allow_test_cleanup:
        raise HTTPException(403, "Activer ALLOW_TEST_CLEANUP=true pour purger en production")

    markers = ("[AUDIT]", "[TEST]", "TEST-WRBH")
    athletes = (
        db.query(Athlete)
        .filter(
            or_(
                Athlete.full_name.ilike("%[AUDIT]%"),
                Athlete.full_name.ilike("%[TEST]%"),
                Athlete.notes.ilike("%[AUDIT]%"),
            )
        )
        .all()
    )
    ids = [a.id for a in athletes]
    deleted = {"athletes": 0, "regs": 0}
    for aid in ids:
        deleted["regs"] += (
            db.query(Registration).filter(Registration.athlete_id == aid).delete(synchronize_session=False)
        )
        db.query(ParentChild).filter(ParentChild.athlete_id == aid).delete(synchronize_session=False)
        ath = db.get(Athlete, aid)
        if ath:
            db.delete(ath)
            deleted["athletes"] += 1
    # Annonces / libellés audit
    from app.models import Announcement, Event, InventoryItem, LedgerEntry

    for model, field in (
        (Announcement, "title"),
        (Event, "title"),
        (LedgerEntry, "label"),
        (InventoryItem, "name"),
    ):
        col = getattr(model, field)
        n = 0
        for m in markers:
            n += db.query(model).filter(col.ilike(f"%{m}%")).delete(synchronize_session=False)
        deleted[model.__tablename__] = n
    db.commit()
    return {"ok": True, "deleted": deleted, "markers": list(markers)}
