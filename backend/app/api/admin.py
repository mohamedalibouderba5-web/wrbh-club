"""Console plateforme Nadi Connect — dashboard multi-clubs (superadmin)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.roles import Role
from app.models import Athlete, Club, Payment, Registration, User

router = APIRouter(prefix="/admin", tags=["admin"])

# Fenêtre « en ligne » (activité API récente)
ONLINE_MINUTES = 15


def _require_superadmin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé super-admin")
    return user


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _online_since() -> datetime:
    return _utc_now() - timedelta(minutes=ONLINE_MINUTES)


def _iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()


def _club_row(c: Club, athletes_count: int, users_count: int = 0, online_count: int = 0) -> dict:
    ends = getattr(c, "trial_ends_on", None)
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "name_ar": getattr(c, "name_ar", None),
        "plan": c.plan,
        "status": c.status,
        "sport": getattr(c, "sport", None),
        "is_platform": bool(getattr(c, "is_platform", False)),
        "trial_ends_on": ends.isoformat() if ends else None,
        "athletes_count": int(athletes_count or 0),
        "users_count": int(users_count or 0),
        "online_count": int(online_count or 0),
        "email": getattr(c, "email", None),
        "phone": getattr(c, "phone", None),
        "created_at": _iso(getattr(c, "created_at", None)),
    }


def _user_row(u: User, club: Club | None, online: bool) -> dict:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role,
        "is_active": bool(u.is_active),
        "club_id": u.club_id,
        "club_slug": club.slug if club else None,
        "club_name": club.name if club else None,
        "last_seen_at": _iso(getattr(u, "last_seen_at", None)),
        "online": online,
        "created_at": _iso(getattr(u, "created_at", None)),
    }


@router.get("/dashboard")
def platform_dashboard(
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """KPI globaux plateforme : clubs, rôles, présence, volumes métier."""
    since = _online_since()
    today = date.today()
    month_start = today.replace(day=1)

    clubs_total = db.query(func.count(Club.id)).scalar() or 0
    clubs_active = (
        db.query(func.count(Club.id))
        .filter(func.lower(Club.status) == "active")
        .scalar()
        or 0
    )
    clubs_suspended = (
        db.query(func.count(Club.id))
        .filter(func.lower(Club.status) == "suspended")
        .scalar()
        or 0
    )
    clubs_trial = (
        db.query(func.count(Club.id))
        .filter(
            or_(
                func.lower(Club.plan) == "discovery",
                Club.trial_ends_on.isnot(None),
            )
        )
        .scalar()
        or 0
    )
    trials_expiring = (
        db.query(func.count(Club.id))
        .filter(
            Club.trial_ends_on.isnot(None),
            Club.trial_ends_on >= today,
            Club.trial_ends_on <= today + timedelta(days=7),
        )
        .scalar()
        or 0
    )

    by_plan_rows = db.query(Club.plan, func.count(Club.id)).group_by(Club.plan).all()
    by_plan = {str(p or "—"): int(n) for p, n in by_plan_rows}

    users_total = db.query(func.count(User.id)).scalar() or 0
    users_active = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    users_inactive = users_total - users_active
    by_role_rows = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    by_role = {str(r or "—"): int(n) for r, n in by_role_rows}

    online_total = (
        db.query(func.count(User.id))
        .filter(User.is_active.is_(True), User.last_seen_at.isnot(None), User.last_seen_at >= since)
        .scalar()
        or 0
    )
    online_by_role_rows = (
        db.query(User.role, func.count(User.id))
        .filter(User.is_active.is_(True), User.last_seen_at.isnot(None), User.last_seen_at >= since)
        .group_by(User.role)
        .all()
    )
    online_by_role = {str(r or "—"): int(n) for r, n in online_by_role_rows}

    athletes_total = db.query(func.count(Athlete.id)).scalar() or 0
    registrations_total = db.query(func.count(Registration.id)).scalar() or 0
    registrations_month = (
        db.query(func.count(Registration.id))
        .filter(Registration.created_at >= datetime.combine(month_start, datetime.min.time()))
        .scalar()
        or 0
    )
    payments_total = db.query(func.count(Payment.id)).scalar() or 0
    payments_month = (
        db.query(func.count(Payment.id)).filter(Payment.paid_on >= month_start).scalar() or 0
    )
    payments_amount_month = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.paid_on >= month_start)
        .scalar()
        or 0
    )

    athlete_counts = dict(
        db.query(Athlete.club_id, func.count(Athlete.id))
        .filter(Athlete.club_id.isnot(None))
        .group_by(Athlete.club_id)
        .all()
    )
    user_counts = dict(
        db.query(User.club_id, func.count(User.id))
        .filter(User.club_id.isnot(None))
        .group_by(User.club_id)
        .all()
    )
    online_counts = dict(
        db.query(User.club_id, func.count(User.id))
        .filter(
            User.club_id.isnot(None),
            User.is_active.is_(True),
            User.last_seen_at.isnot(None),
            User.last_seen_at >= since,
        )
        .group_by(User.club_id)
        .all()
    )

    recent_clubs = (
        db.query(Club).order_by(Club.created_at.desc().nullslast(), Club.id.desc()).limit(8).all()
    )
    recent_club_rows = [
        _club_row(
            c,
            athlete_counts.get(c.id, 0),
            user_counts.get(c.id, 0),
            online_counts.get(c.id, 0),
        )
        for c in recent_clubs
    ]

    online_users = (
        db.query(User)
        .filter(User.is_active.is_(True), User.last_seen_at.isnot(None), User.last_seen_at >= since)
        .order_by(User.last_seen_at.desc())
        .limit(40)
        .all()
    )
    club_ids = {u.club_id for u in online_users if u.club_id}
    clubs_map = {
        c.id: c for c in db.query(Club).filter(Club.id.in_(club_ids)).all()
    } if club_ids else {}
    online_user_rows = [
        _user_row(u, clubs_map.get(u.club_id) if u.club_id else None, True) for u in online_users
    ]

    return {
        "generated_at": _iso(_utc_now()),
        "online_window_minutes": ONLINE_MINUTES,
        "clubs": {
            "total": int(clubs_total),
            "active": int(clubs_active),
            "suspended": int(clubs_suspended),
            "trialish": int(clubs_trial),
            "trials_expiring_7d": int(trials_expiring),
            "by_plan": by_plan,
        },
        "users": {
            "total": int(users_total),
            "active": int(users_active),
            "inactive": int(users_inactive),
            "by_role": by_role,
            "online": int(online_total),
            "online_by_role": online_by_role,
        },
        "activity": {
            "athletes_total": int(athletes_total),
            "registrations_total": int(registrations_total),
            "registrations_month": int(registrations_month),
            "payments_total": int(payments_total),
            "payments_month": int(payments_month),
            "payments_amount_month": float(payments_amount_month),
        },
        "recent_clubs": recent_club_rows,
        "online_users": online_user_rows,
    }


@router.get("/clubs")
def list_clubs(
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Liste clubs + compteurs athlètes / comptes / en ligne."""
    since = _online_since()
    athlete_counts = dict(
        db.query(Athlete.club_id, func.count(Athlete.id))
        .filter(Athlete.club_id.isnot(None))
        .group_by(Athlete.club_id)
        .all()
    )
    user_counts = dict(
        db.query(User.club_id, func.count(User.id))
        .filter(User.club_id.isnot(None))
        .group_by(User.club_id)
        .all()
    )
    online_counts = dict(
        db.query(User.club_id, func.count(User.id))
        .filter(
            User.club_id.isnot(None),
            User.is_active.is_(True),
            User.last_seen_at.isnot(None),
            User.last_seen_at >= since,
        )
        .group_by(User.club_id)
        .all()
    )
    clubs = db.query(Club).order_by(Club.name.asc()).all()
    return [
        _club_row(
            c,
            athlete_counts.get(c.id, 0),
            user_counts.get(c.id, 0),
            online_counts.get(c.id, 0),
        )
        for c in clubs
    ]


class ClubPatchIn(BaseModel):
    status: str | None = Field(None, description="active | suspended")
    plan: str | None = None
    is_platform: bool | None = None
    trial_ends_on: date | None = None


@router.patch("/clubs/{club_id}")
def patch_club(
    club_id: int,
    body: ClubPatchIn,
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Suspendre / plan / essai — ops plateforme."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club introuvable")
    if body.status is not None:
        st = body.status.strip().lower()
        if st not in ("active", "suspended"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="status doit être active ou suspended",
            )
        club.status = st
    if body.plan is not None:
        club.plan = body.plan.strip() or club.plan
    if body.is_platform is not None:
        club.is_platform = bool(body.is_platform)
    if "trial_ends_on" in body.model_fields_set:
        club.trial_ends_on = body.trial_ends_on
    db.commit()
    db.refresh(club)
    since = _online_since()
    n_ath = db.query(func.count(Athlete.id)).filter(Athlete.club_id == club.id).scalar() or 0
    n_usr = db.query(func.count(User.id)).filter(User.club_id == club.id).scalar() or 0
    n_on = (
        db.query(func.count(User.id))
        .filter(
            User.club_id == club.id,
            User.is_active.is_(True),
            User.last_seen_at.isnot(None),
            User.last_seen_at >= since,
        )
        .scalar()
        or 0
    )
    return _club_row(club, n_ath, n_usr, n_on)


@router.get("/users")
def list_users(
    role: str | None = Query(None),
    online_only: bool = Query(False),
    q: str | None = Query(None, max_length=80),
    limit: int = Query(100, ge=1, le=300),
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Comptes tous clubs — filtre rôle / en ligne / recherche."""
    since = _online_since()
    query = db.query(User)
    if role:
        query = query.filter(User.role == role.strip().lower())
    if online_only:
        query = query.filter(
            User.is_active.is_(True),
            User.last_seen_at.isnot(None),
            User.last_seen_at >= since,
        )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(like),
                User.email.ilike(like),
                User.phone.ilike(like),
            )
        )
    users = query.order_by(User.last_seen_at.desc().nullslast(), User.id.desc()).limit(limit).all()
    club_ids = {u.club_id for u in users if u.club_id}
    clubs_map = {
        c.id: c for c in db.query(Club).filter(Club.id.in_(club_ids)).all()
    } if club_ids else {}
    rows = []
    for u in users:
        club = clubs_map.get(u.club_id) if u.club_id else None
        seen = getattr(u, "last_seen_at", None)
        is_online = bool(
            u.is_active and seen and (seen.replace(tzinfo=timezone.utc) if seen.tzinfo is None else seen) >= since
        )
        rows.append(_user_row(u, club, is_online))
    return {"online_window_minutes": ONLINE_MINUTES, "count": len(rows), "items": rows}


class UserPatchIn(BaseModel):
    is_active: bool | None = None


@router.patch("/users/{user_id}")
def patch_user(
    user_id: int,
    body: UserPatchIn,
    actor: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Activer / désactiver un compte (pas de superadmin cible)."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")
    if target.role == Role.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Impossible de modifier un super-admin")
    if target.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action interdite sur soi-même")
    if body.is_active is not None:
        target.is_active = bool(body.is_active)
    db.commit()
    db.refresh(target)
    club = db.get(Club, target.club_id) if target.club_id else None
    since = _online_since()
    seen = getattr(target, "last_seen_at", None)
    is_online = bool(
        target.is_active
        and seen
        and (seen.replace(tzinfo=timezone.utc) if seen.tzinfo is None else seen) >= since
    )
    return _user_row(target, club, is_online)
