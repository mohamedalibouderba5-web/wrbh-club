from datetime import datetime, timezone
from collections import defaultdict
import os
import time

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import create_access_token, hash_password, verify_password
from app.core.tenant import get_current_club_id
from app.models import Athlete, Category, Club, Discipline, ParentChild, Registration, Season, User
from app.schemas import (
    ClubOnboardIn,
    ClubOnboardOut,
    ClubOut,
    ClubPublicOut,
    PasswordChangeIn,
    TokenOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services.parents import find_user_by_phone
from app.services.sports import (
    SPORT_LABELS,
    SPORT_LABELS_AR,
    category_code_for,
    default_age_bands,
    normalize_sport,
    sport_code_short,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_login_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_hit(key: str, *, limit: int, window: int, detail: str) -> None:
    now = time.time()
    hits = [t for t in _login_hits[key] if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail=detail)
    hits.append(now)
    _login_hits[key] = hits


def _rate_limit_login(request: Request, username: str) -> None:
    """B3 : limite stricte par compte + plafond IP large (NAT / stand salon)."""
    ip = _client_ip(request)
    window = settings.login_rate_window_seconds
    account = (username or "").strip().lower() or "anonymous"
    _rate_hit(
        f"login:user:{account}",
        limit=settings.login_rate_limit,
        window=window,
        detail="Trop de tentatives de connexion pour ce compte. Réessayez plus tard.",
    )
    _rate_hit(
        f"login:ip:{ip}",
        limit=settings.login_rate_limit_ip,
        window=window,
        detail="Trop de tentatives de connexion depuis ce réseau. Réessayez plus tard.",
    )


def _rate_limit_onboard(request: Request, key: str) -> None:
    """Compteur séparé du login — message adapté à la création de club."""
    ip = _client_ip(request)
    window = settings.login_rate_window_seconds
    ident = (key or "").strip().lower() or "anonymous"
    _rate_hit(
        f"onboard:user:{ident}",
        limit=settings.onboard_rate_limit,
        window=window,
        detail="Trop de tentatives de création de club. Réessayez plus tard.",
    )
    _rate_hit(
        f"onboard:ip:{ip}",
        limit=settings.onboard_rate_limit_ip,
        window=window,
        detail="Trop de créations de club depuis ce réseau. Réessayez plus tard.",
    )


def _deploy_git_sha() -> str:
    sha = (settings.git_sha or os.environ.get("GIT_SHA") or os.environ.get("GIT_COMMIT") or "").strip()
    if sha:
        return sha[:40]
    try:
        from pathlib import Path

        baked = Path(__file__).resolve().parents[2] / "GIT_SHA"
        if baked.exists():
            return baked.read_text(encoding="utf-8").strip()[:40]
    except Exception:
        pass
    return "unknown"


def _resolve_club_id(db: Session, club_slug: str | None) -> int | None:
    if not club_slug or not club_slug.strip():
        return None
    club = db.query(Club).filter(Club.slug == club_slug.strip().lower()).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club introuvable (code club incorrect)")
    # Club suspendu : login autorisé (lecture seule) — écritures bloquées via get_current_club_id
    return int(club.id)


@router.post("/login", response_model=TokenOut)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    club_slug: str | None = Form(None),
    db: Session = Depends(get_db),
):
    _rate_limit_login(request, form.username)
    club_id = _resolve_club_id(db, club_slug)

    user = None
    email = (form.username or "").strip()
    if email and "@" in email:
        q = db.query(User).filter(User.email == email)
        if club_id is not None:
            q = q.filter(User.club_id == club_id)
        user = q.first()
    if not user:
        user = find_user_by_phone(db, form.username, club_id=club_id)
    # Compat mono-club : si slug fourni mais user trouvé ailleurs, refuse
    if not user and club_id is not None:
        # retente sans filtre pour message clair
        other = db.query(User).filter(User.email == email).first() if "@" in email else find_user_by_phone(db, form.username)
        if other and getattr(other, "club_id", None) not in (None, club_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ce compte appartient à un autre club — vérifiez le code club",
            )
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte désactivé")
    # Si un slug est fourni, l'utilisateur doit appartenir à ce club (sauf superadmin)
    if club_id is not None and user.role != Role.SUPERADMIN:
        if getattr(user, "club_id", None) not in (None, club_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ce compte n'appartient pas à ce club",
            )
        # Rattache les anciens comptes NULL au club choisi (migration douce)
        if getattr(user, "club_id", None) is None and user.role != Role.SUPERADMIN:
            user.club_id = club_id
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    token_club = getattr(user, "club_id", None) or club_id
    token = create_access_token(
        user.id, {"role": user.role, "club_id": token_club}
    )
    return TokenOut(
        access_token=token,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        club_id=token_club,
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
        q = q.filter(User.club_id == club_id)
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
    new_role = data.pop("role", None)
    explicit_mcp = data.pop("must_change_password", None)
    if new_role is not None:
        try:
            role = Role(new_role)
        except ValueError as exc:
            raise HTTPException(400, f"Rôle invalide: {new_role}") from exc
        if role == Role.ADMIN and actor.role != Role.ADMIN:
            raise HTTPException(403, "Seul un admin peut attribuer le rôle admin")
        if role == Role.SUPERADMIN:
            raise HTTPException(403, "Rôle super-admin interdit")
        if target.role == Role.ADMIN and actor.role != Role.ADMIN:
            raise HTTPException(403, "Seul un admin peut modifier un compte admin")
        target.role = str(role)
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
        # Par défaut force le changement ; l'admin peut forcer False (comptes démo / stand)
        target.must_change_password = True if explicit_mcp is None else bool(explicit_mcp)
    elif explicit_mcp is not None:
        target.must_change_password = bool(explicit_mcp)
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


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    """Supprime (désactive + détache) un coach/staff. Les admins ne sont pas effaçables ici."""
    from app.models import Event, TeamCoach
    from app.services.audit import write_audit

    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    actor_club = getattr(actor, "club_id", None)
    target_club = getattr(target, "club_id", None)
    if actor_club and target_club not in (None, actor_club):
        raise HTTPException(404, "Utilisateur introuvable")
    if target.id == actor.id:
        raise HTTPException(400, "Impossible de supprimer votre propre compte")
    if target.role in (Role.SUPERADMIN, Role.ADMIN):
        raise HTTPException(403, "Impossible de supprimer un compte admin")
    if target.role not in (Role.COACH, Role.STAFF):
        raise HTTPException(400, "Seuls coach / staff peuvent être supprimés ici")

    # Détacher des équipes et des séances
    db.query(TeamCoach).filter(TeamCoach.user_id == user_id).delete(synchronize_session=False)
    for ev in db.query(Event).filter(Event.coach_id == user_id).all():
        ev.coach_id = None
    for ev in db.query(Event).filter(Event.substitute_coach_id == user_id).all():
        ev.substitute_coach_id = None

    target.is_active = False
    write_audit(
        db,
        action="delete",
        entity="user",
        entity_id=target.id,
        user_id=actor.id,
        club_id=actor_club,
        detail=f"role={target.role} name={target.full_name} soft_delete=1",
    )
    db.commit()
    return {"deleted": user_id, "soft": True}


club_router = APIRouter(prefix="/club", tags=["club"])


def _slugify_candidate(raw: str) -> str:
    import re

    s = (raw or "").strip().lower()
    s = re.sub(r"[^a-z0-9\-]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:60]


@club_router.get("/list", response_model=list[ClubPublicOut])
def list_public_clubs(db: Session = Depends(get_db)):
    """Vitrine publique uniquement (`is_platform=True`).

    B4 : ne plus exposer le portefeuille clients. Le login se fait par slug saisi.
    """
    rows = (
        db.query(Club)
        .filter(
            Club.is_platform.is_(True),
            Club.status.in_(["active", "trial"]),
            Club.slug.isnot(None),
        )
        .order_by(Club.name.asc())
        .all()
    )
    out: list[ClubPublicOut] = []
    for c in rows:
        if not c.slug:
            continue
        slug_l = c.slug.lower()
        if slug_l.startswith("zztest") or slug_l.startswith("test-") or "zztest" in slug_l:
            continue
        out.append(
            ClubPublicOut(
                slug=c.slug,
                name=c.name,
                name_ar=c.name_ar,
                acronym=c.acronym or "CLUB",
                sport=c.sport or "football",
                primary_color=c.primary_color or "#1E3A8A",
                accent_color=c.accent_color or "#F5C518",
                logo_path=c.logo_path,
                app_name=c.app_name,
            )
        )
    return out


@club_router.get("/sports")
def list_sports():
    """Sports prioritaires marché Algérie (commercialisation)."""
    return [
        {"code": k, "label": v, "label_ar": SPORT_LABELS_AR.get(k)}
        for k, v in SPORT_LABELS.items()
    ]


def _seed_discipline_categories(
    db: Session,
    *,
    club_id: int,
    season_id: int,
    disc: Discipline,
    sport: str,
) -> int:
    created = 0
    for suffix, name, name_ar, ymin, ymax in default_age_bands(sport):
        code = category_code_for(sport, suffix)
        exists = (
            db.query(Category)
            .filter(Category.season_id == season_id, Category.code == code)
            .first()
        )
        if exists:
            continue
        db.add(
            Category(
                club_id=club_id,
                season_id=season_id,
                discipline_id=disc.id,
                code=code,
                name=f"{SPORT_LABELS.get(sport, sport)} {name}",
                name_ar=f"{SPORT_LABELS_AR.get(sport, '')} {name_ar}".strip(),
                birth_year_min=ymin,
                birth_year_max=ymax,
                is_active=True,
            )
        )
        created += 1
    return created


@club_router.get("/branding", response_model=ClubOut)
def branding(slug: str | None = None, db: Session = Depends(get_db)):
    """Branding public. Phase 1 multi-club : sélection par slug à la connexion.
    Sans slug → premier club (compat mono-club)."""
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


@club_router.post("/onboard", response_model=ClubOnboardOut)
def onboard_club(payload: ClubOnboardIn, request: Request, db: Session = Depends(get_db)):
    """Crée un club + admin + saison + disciplines (essai discovery 14 jours)."""
    _rate_limit_onboard(request, payload.admin_email or payload.slug)
    slug = _slugify_candidate(payload.slug)
    if len(slug) < 2:
        raise HTTPException(400, "Code club (slug) invalide")
    if db.query(Club).filter(Club.slug == slug).first():
        raise HTTPException(409, "Ce code club est déjà pris — choisissez-en un autre")
    if not payload.admin_email:
        raise HTTPException(400, "Email admin obligatoire")
    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(409, "Email admin déjà utilisé")
    admin_phone = (payload.admin_phone or "").strip() or None
    if admin_phone:
        from app.services.phone import normalize_phone, phone_lookup_variants

        variants = [v for v in phone_lookup_variants(admin_phone) if v]
        n = normalize_phone(admin_phone)
        if n and n not in variants:
            variants.append(n)
        if variants and db.query(User).filter(User.phone.in_(variants)).first():
            raise HTTPException(409, "Téléphone admin déjà utilisé")

    primary = normalize_sport(payload.sport)
    extra = [normalize_sport(s) for s in (payload.sports or [])]
    sports_ordered: list[str] = []
    for s in [primary, *extra]:
        if s not in sports_ordered:
            sports_ordered.append(s)

    from datetime import date, timedelta

    trial_end = date.today() + timedelta(days=14)
    club = Club(
        slug=slug,
        name=payload.club_name.strip(),
        name_ar=(payload.club_name_ar or "").strip() or None,
        acronym=(payload.acronym or "CLUB").strip().upper()[:20],
        sport=primary,
        status="trial",
        plan="discovery",
        trial_ends_on=trial_end,
        locale_default=payload.locale or "fr",
        currency="DZD",
        app_name=payload.club_name.strip()[:120],
    )
    db.add(club)
    db.flush()

    admin = User(
        club_id=club.id,
        email=payload.admin_email,
        phone=admin_phone,
        full_name=payload.admin_full_name.strip(),
        role=Role.ADMIN,
        password_hash=hash_password(payload.admin_password),
        locale=payload.locale or "fr",
        must_change_password=False,
        is_active=True,
    )
    db.add(admin)
    try:
        db.flush()
    except Exception as exc:
        db.rollback()
        # IntegrityError téléphone/email (course) → 409 propre
        from sqlalchemy.exc import IntegrityError

        if isinstance(exc, IntegrityError):
            raise HTTPException(409, "Email ou téléphone admin déjà utilisé") from exc
        raise

    now = datetime.now(timezone.utc)
    y = now.year
    season = Season(
        club_id=club.id,
        name=f"{y}/{y + 1}",
        starts_on=date(y, 8, 1),
        ends_on=date(y + 1, 7, 31),
        is_current=True,
        registration_open=True,
    )
    db.add(season)
    db.flush()

    for sport in sports_ordered:
        disc = Discipline(
            club_id=club.id,
            name=SPORT_LABELS.get(sport, sport.title()),
            name_ar=SPORT_LABELS_AR.get(sport),
            code=sport_code_short(sport),
        )
        db.add(disc)
        db.flush()
        _seed_discipline_categories(
            db, club_id=club.id, season_id=season.id, disc=disc, sport=sport
        )

    from app.services.audit import write_audit

    write_audit(
        db,
        action="onboard",
        entity="club",
        entity_id=club.id,
        user_id=admin.id,
        club_id=club.id,
        detail=f"slug={slug} sports={','.join(sports_ordered)} plan=discovery",
    )
    db.commit()
    return ClubOnboardOut(
        club_id=club.id,
        slug=slug,
        name=club.name,
        sport=primary,
        plan="discovery",
        trial_ends_on=trial_end,
        admin_email=payload.admin_email,
        login_hint=f"Connectez-vous avec le code club « {slug} » et l'email {payload.admin_email}",
    )


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
    sha = _deploy_git_sha()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version or "1.18.0",
        "git_sha": sha[:12] if sha and sha != "unknown" else sha,
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
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPERADMIN)),
    club_id: int = Depends(get_current_club_id),
):
    """Purge données marquées [AUDIT] / [TEST] — **uniquement le club courant**."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    if settings.is_production and not settings.allow_test_cleanup:
        raise HTTPException(403, "Activer ALLOW_TEST_CLEANUP=true pour purger en production")

    markers = ("[AUDIT]", "[TEST]", "TEST-WRBH")
    athletes = (
        db.query(Athlete)
        .filter(
            Athlete.club_id == club_id,
            or_(
                Athlete.full_name.ilike("%[AUDIT]%"),
                Athlete.full_name.ilike("%[TEST]%"),
                Athlete.notes.ilike("%[AUDIT]%"),
            ),
        )
        .all()
    )
    ids = [a.id for a in athletes]
    deleted = {"athletes": 0, "regs": 0}
    for aid in ids:
        deleted["regs"] += (
            db.query(Registration)
            .filter(Registration.athlete_id == aid, Registration.club_id == club_id)
            .delete(synchronize_session=False)
        )
        db.query(ParentChild).filter(
            ParentChild.athlete_id == aid, ParentChild.club_id == club_id
        ).delete(synchronize_session=False)
        ath = db.get(Athlete, aid)
        if ath and ath.club_id == club_id:
            db.delete(ath)
            deleted["athletes"] += 1
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
            n += (
                db.query(model)
                .filter(model.club_id == club_id, col.ilike(f"%{m}%"))
                .delete(synchronize_session=False)
            )
        deleted[model.__tablename__] = n
    db.commit()
    return {"ok": True, "deleted": deleted, "markers": list(markers), "club_id": club_id}