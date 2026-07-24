from datetime import date
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session, load_only

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import hash_password
from app.models import (
    Announcement,
    Athlete,
    Attendance,
    Category,
    Convocation,
    EmergencyContact,
    Event,
    FeeInstallment,
    Notification,
    ParentChild,
    Payment,
    Registration,
    Season,
    Team,
    TeamCoach,
    TeamMembership,
    User,
)
from app.schemas import (
    AthleteCreate,
    AthleteOut,
    AthleteUpdate,
    CategoryOut,
    RegistrationCreate,
    RegistrationOut,
    SeasonOut,
    TeamOut,
)
from app.services.age import validate_category_for_birth, validate_club_age
from app.services.blood import validate_blood_type
from app.services.fast_cache import cache_delete_prefix, cache_get, cache_set
from app.services.fees import ensure_subscription_installment
from app.services.notify import notify_parents_of_athlete, notify_role
from app.services.parents import ensure_parent_account
from app.services.phone import normalize_phone, validate_dz_mobile
from app.services.media import enrich_media_path

TEST_MARKER = "TEST-WRBH-BATCH"
settings = get_settings()

router = APIRouter(tags=["structure"])

_STATS_CACHE: dict = {"ts": 0.0, "payload": None}
_STATS_TTL_SEC = 45.0


def _bust_club_caches() -> None:
    cache_delete_prefix("athletes:")
    cache_delete_prefix("regs:")
    cache_delete_prefix("bootstrap:")
    cache_delete_prefix("categories:")
    cache_delete_prefix("finance:")
    _STATS_CACHE["payload"] = None
    _STATS_CACHE["ts"] = 0.0


@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cached = cache_get("seasons:all")
    if cached is not None:
        return cached
    rows = db.query(Season).order_by(Season.starts_on.desc()).all()
    out = [SeasonOut.model_validate(s) for s in rows]
    cache_set("seasons:all", out, 120)
    return out


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    season_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    key = f"categories:{season_id or 'current'}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    q = db.query(Category)
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        if current:
            q = q.filter(Category.season_id == current.id)
    rows = q.order_by(Category.birth_year_min).all()
    out = [CategoryOut.model_validate(c) for c in rows]
    cache_set(key, out, 120)
    return out


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Un seul appel : saisons + catégories + stats + finance (si staff) + compte événements."""
    key = f"bootstrap:{user.role}:{user.id}"
    cached = cache_get(key)
    if cached is not None:
        return cached

    seasons = list_seasons(db, user)
    categories = list_categories(None, db, user)
    stats = club_stats(db, user)
    events_count = db.query(func.count(Event.id)).filter(Event.is_cancelled.is_(False)).scalar() or 0
    finance = None
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF}:
        from app.api.finance import finance_dashboard

        try:
            finance = finance_dashboard(db, user)
        except Exception:
            finance = None

    payload = {
        "seasons": [s.model_dump() if hasattr(s, "model_dump") else s for s in seasons],
        "categories": [c.model_dump() if hasattr(c, "model_dump") else c for c in categories],
        "stats": stats,
        "events_count": int(events_count),
        "finance": finance,
    }
    cache_set(key, payload, 25)
    return payload


@router.get("/teams", response_model=list[TeamOut])
def list_teams(
    category_id: int | None = None,
    season_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Par défaut : équipes de la saison courante uniquement (évite les doublons inter-saisons)."""
    q = db.query(Team)
    if category_id:
        q = q.filter(Team.category_id == category_id)
    else:
        sid = season_id
        if not sid:
            cur = db.query(Season).filter(Season.is_current.is_(True)).first()
            sid = cur.id if cur else None
        if sid:
            cat_ids = [c.id for c in db.query(Category.id).filter(Category.season_id == sid)]
            if cat_ids:
                q = q.filter(Team.category_id.in_(cat_ids))
    return q.order_by(Team.name).all()


@router.get("/stats/club")
def club_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Stats rapides : agrégats SQL + cache court (20 s)."""
    now = monotonic()
    cached = _STATS_CACHE.get("payload")
    if cached is not None and now - float(_STATS_CACHE["ts"]) < _STATS_TTL_SEC:
        return cached

    season = db.query(Season).filter(Season.is_current.is_(True)).first()

    athletes_total = db.query(func.count(Athlete.id)).scalar() or 0
    athletes_active = (
        db.query(func.count(Athlete.id)).filter(Athlete.status == "Active").scalar() or 0
    )
    athletes_left = (
        db.query(func.count(Athlete.id))
        .filter(Athlete.status.in_(["Abandonne", "Left", "Inactif"]))
        .scalar()
        or 0
    )
    by_status = {
        status: int(count)
        for status, count in db.query(Athlete.status, func.count(Athlete.id)).group_by(Athlete.status).all()
    }
    missing_birth = (
        db.query(func.count(Athlete.id)).filter(Athlete.birth_date.is_(None)).scalar() or 0
    )

    # Une seule lecture légère (id, status, année) pour classer par catégories
    light = db.query(Athlete.id, Athlete.status, Athlete.birth_date).all()
    cats_out = []
    classified_active: set[int] = set()
    if season:
        cat_rows = (
            db.query(Category)
            .filter(Category.season_id == season.id)
            .order_by(Category.birth_year_min)
            .all()
        )
        for cat in cat_rows:
            birth_count = 0
            for aid, status, bdate in light:
                if bdate is None:
                    continue
                y = bdate.year
                if cat.birth_year_min <= y <= cat.birth_year_max:
                    birth_count += 1
                    if status == "Active":
                        classified_active.add(aid)
            cats_out.append(
                {
                    "code": cat.code,
                    "name": cat.name,
                    "name_ar": cat.name_ar,
                    "birth_years": f"{cat.birth_year_min}-{cat.birth_year_max}",
                    "members": birth_count,
                    "by_birth_year": birth_count,
                    "by_membership": 0,
                    "by_registration": 0,
                }
            )

    unclassified = sum(
        1
        for aid, status, bdate in light
        if status == "Active" and bdate is not None and aid not in classified_active
    )

    regs_pending = db.query(func.count(Registration.id)).filter(Registration.status == "pending").scalar() or 0
    parents = db.query(func.count(User.id)).filter(User.role == Role.PARENT).scalar() or 0
    payload = {
        "season": season.name if season else None,
        "athletes_total": int(athletes_total),
        "athletes_active": int(athletes_active),
        "athletes_left": int(athletes_left),
        "by_status": by_status,
        "categories": cats_out,
        "unclassified_active": unclassified,
        "missing_birth_date": int(missing_birth),
        "registrations_pending": int(regs_pending),
        "parents_count": int(parents),
    }
    _STATS_CACHE["ts"] = now
    _STATS_CACHE["payload"] = payload
    return payload


athletes_router = APIRouter(prefix="/athletes", tags=["athletes"])


def _parent_athlete_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id).all()
    return {r[0] for r in rows}


def _athlete_parent_phone(db: Session, athlete_id: int) -> str | None:
    link = db.query(ParentChild).filter(ParentChild.athlete_id == athlete_id).first()
    if not link:
        ec = db.query(EmergencyContact).filter(EmergencyContact.athlete_id == athlete_id).first()
        return ec.phone if ec else None
    parent = db.get(User, link.parent_id)
    return parent.phone if parent else None


_MISSING = object()


def _to_athlete_out(
    db: Session,
    athlete: Athlete,
    *,
    parent_phone: str | None | object = _MISSING,
    category_id: int | None = None,
    category_code: str | None = None,
) -> AthleteOut:
    # Important : si parent_phone vient du bulk (même None), ne pas retomber en N+1
    phone = (
        _athlete_parent_phone(db, athlete.id) if parent_phone is _MISSING else parent_phone  # type: ignore[arg-type]
    )
    return AthleteOut(
        id=athlete.id,
        legacy_number=athlete.legacy_number,
        full_name=athlete.full_name,
        full_name_ar=athlete.full_name_ar,
        birth_date=athlete.birth_date,
        birth_place=athlete.birth_place,
        status=athlete.status,
        license_number=athlete.license_number,
        notes=athlete.notes,
        photo_path=enrich_media_path(athlete.photo_path),
        blood_type=getattr(athlete, "blood_type", None),
        parent_phone=phone,  # type: ignore[arg-type]
        category_id=category_id,
        category_code=category_code,
    )


def _category_map_for_season(db: Session, season_id: int | None) -> list[Category]:
    q = db.query(Category)
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        if current:
            q = q.filter(Category.season_id == current.id)
    return q.order_by(Category.birth_year_min).all()


def _cat_for_birth(cats: list[Category], birth) -> tuple[int | None, str | None]:
    if not birth:
        return None, None
    year = birth.year if hasattr(birth, "year") else int(str(birth)[:4])
    for c in cats:
        if c.birth_year_min <= year <= c.birth_year_max:
            return c.id, c.code
    return None, None


@athletes_router.get("", response_model=list[AthleteOut])
def list_athletes(
    q: str | None = None,
    status: str | None = Query(None, alias="status"),
    category_id: int | None = None,
    season_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = min(limit, settings.max_page_size)
    cache_key = f"athletes:{user.role}:{user.id}:{q}:{status}:{category_id}:{season_id}:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    season = season_id
    if not season:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        season = current.id if current else None
    cats = _category_map_for_season(db, season)

    # Téléphones parents en une seule jointure (plus de requêtes N+1)
    parent_phone_sq = (
        db.query(ParentChild.athlete_id.label("aid"), func.max(User.phone).label("phone"))
        .join(User, User.id == ParentChild.parent_id)
        .group_by(ParentChild.athlete_id)
        .subquery()
    )
    ec_phone_sq = (
        db.query(EmergencyContact.athlete_id.label("aid"), func.max(EmergencyContact.phone).label("phone"))
        .group_by(EmergencyContact.athlete_id)
        .subquery()
    )

    query = (
        db.query(Athlete, func.coalesce(parent_phone_sq.c.phone, ec_phone_sq.c.phone).label("parent_phone"))
        .outerjoin(parent_phone_sq, parent_phone_sq.c.aid == Athlete.id)
        .outerjoin(ec_phone_sq, ec_phone_sq.c.aid == Athlete.id)
        .options(
            load_only(
                Athlete.id,
                Athlete.legacy_number,
                Athlete.full_name,
                Athlete.full_name_ar,
                Athlete.birth_date,
                Athlete.birth_place,
                Athlete.status,
                Athlete.license_number,
                Athlete.photo_path,
                Athlete.blood_type,
            )
        )
    )
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        query = query.filter(Athlete.id.in_(ids or {-1}))
    if status:
        query = query.filter(Athlete.status == status)
    if q:
        query = query.filter(Athlete.full_name.ilike(f"%{q}%"))
    if category_id:
        cat = next((c for c in cats if c.id == category_id), None) or db.get(Category, category_id)
        if cat:
            query = query.filter(
                Athlete.birth_date.isnot(None),
                extract("year", Athlete.birth_date) >= cat.birth_year_min,
                extract("year", Athlete.birth_date) <= cat.birth_year_max,
            )
        else:
            query = query.filter(Athlete.id == -1)

    rows = query.order_by(Athlete.full_name).offset(skip).limit(limit).all()
    out: list[AthleteOut] = []
    for athlete, phone in rows:
        cid, ccode = _cat_for_birth(cats, athlete.birth_date)
        out.append(
            AthleteOut(
                id=athlete.id,
                legacy_number=athlete.legacy_number,
                full_name=athlete.full_name,
                full_name_ar=athlete.full_name_ar,
                birth_date=athlete.birth_date,
                birth_place=athlete.birth_place,
                status=athlete.status,
                license_number=athlete.license_number,
                notes=None,
                photo_path=enrich_media_path(athlete.photo_path),
                blood_type=getattr(athlete, "blood_type", None),
                parent_phone=phone,
                category_id=cid,
                category_code=ccode,
            )
        )
    cache_set(cache_key, out, 30)
    return out


@athletes_router.post("", response_model=AthleteOut)
def create_athlete(
    payload: AthleteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    try:
        validate_club_age(payload.birth_date, required=True)
        if payload.parent_phone:
            validate_dz_mobile(payload.parent_phone, required=True)
        if payload.blood_type is not None:
            payload.blood_type = validate_blood_type(payload.blood_type)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    data = payload.model_dump(exclude={"parent_phone", "parent_name"})
    if "blood_type" in data:
        data["blood_type"] = validate_blood_type(data.get("blood_type"))
    athlete = Athlete(**data)
    db.add(athlete)
    db.flush()
    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        db.add(
            EmergencyContact(
                athlete_id=athlete.id,
                name=payload.parent_name or "Parent",
                phone=normalize_phone(payload.parent_phone) or payload.parent_phone,
                relation="parent",
            )
        )
    db.commit()
    db.refresh(athlete)
    _bust_club_caches()
    return _to_athlete_out(db, athlete)


@athletes_router.get("/{athlete_id}", response_model=AthleteOut)
def get_athlete(athlete_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    if user.role == Role.PARENT and athlete_id not in _parent_athlete_ids(db, user):
        raise HTTPException(403, "Accès refusé")
    return _to_athlete_out(db, athlete)


@athletes_router.patch("/{athlete_id}", response_model=AthleteOut)
def update_athlete(
    athlete_id: int,
    payload: AthleteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")

    data = payload.model_dump(exclude_unset=True, exclude={"confirm_status", "parent_phone", "parent_name"})
    new_status = data.get("status")
    if new_status and new_status != athlete.status:
        if new_status in {"Abandonne", "Left", "Inactif"} and not payload.confirm_status:
            raise HTTPException(
                400,
                "Confirmation requise pour changer le statut (confirm_status=true). Ajoutez une note.",
            )
        if new_status in {"Abandonne", "Left", "Inactif"} and not (payload.notes or athlete.notes):
            raise HTTPException(400, "Une note est obligatoire quand le joueur quitte le club.")

    birth = data.get("birth_date", athlete.birth_date)
    try:
        if "birth_date" in data:
            validate_club_age(birth, required=True)
        if payload.parent_phone:
            validate_dz_mobile(payload.parent_phone, required=True)
        if "blood_type" in data:
            data["blood_type"] = validate_blood_type(data.get("blood_type"))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    for k, v in data.items():
        setattr(athlete, k, v)

    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if new_status and new_status in {"Abandonne", "Left", "Inactif"}:
        note = payload.notes or athlete.notes or ""
        title = f"Joueur — {athlete.full_name}"
        body = f"Statut mis à jour : {new_status}. {note}".strip()
        notify_parents_of_athlete(db, athlete.id, title, body, kind="status")
        notify_role(db, Role.ADMIN, title, body, kind="status")

    db.commit()
    db.refresh(athlete)
    _bust_club_caches()
    return _to_athlete_out(db, athlete)


@athletes_router.delete("/{athlete_id}")
def delete_athlete(
    athlete_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    # cascade-ish cleanup of related rows
    for model in (Attendance, Convocation, FeeInstallment, Payment, TeamMembership, ParentChild, EmergencyContact, Registration):
        db.query(model).filter(getattr(model, "athlete_id") == athlete_id).delete(synchronize_session=False)
    db.delete(athlete)
    db.commit()
    _bust_club_caches()
    return {"deleted": athlete_id}


@router.post("/system/cleanup-tests")
def cleanup_test_batch(
    marker: str = TEST_MARKER,
    confirm: bool = Query(False, description="Doit être true"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime les données de test. En production : ALLOW_TEST_CLEANUP=true + confirm=true."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true pour confirmer la purge des tests.")
    if settings.is_production and not settings.allow_test_cleanup:
        raise HTTPException(
            403,
            "Cleanup tests désactivé en production (définir ALLOW_TEST_CLEANUP=true si besoin).",
        )
    athletes = (
        db.query(Athlete)
        .filter(
            (Athlete.notes.contains(marker))
            | (Athlete.full_name.contains("[TEST]"))
            | (Athlete.full_name.contains("[VERIFY]"))
            | (Athlete.notes.contains("VERIFY"))
        )
        .all()
    )
    ids = [a.id for a in athletes]
    deleted_events = 0
    # events titled with marker
    events = db.query(Event).filter(Event.title.contains(marker)).all()
    for ev in events:
        db.query(Attendance).filter(Attendance.event_id == ev.id).delete(synchronize_session=False)
        db.query(Convocation).filter(Convocation.event_id == ev.id).delete(synchronize_session=False)
        db.delete(ev)
        deleted_events += 1
    for athlete_id in ids:
        for model in (Attendance, Convocation, FeeInstallment, Payment, TeamMembership, ParentChild, EmergencyContact, Registration):
            db.query(model).filter(getattr(model, "athlete_id") == athlete_id).delete(synchronize_session=False)
        ath = db.get(Athlete, athlete_id)
        if ath:
            db.delete(ath)
    # test parent users by phone prefix 069911
    parents = db.query(User).filter(User.role == Role.PARENT, User.phone.like("069911%")).all()
    parent_ids = [p.id for p in parents]
    if parent_ids:
        db.query(Notification).filter(Notification.user_id.in_(parent_ids)).delete(synchronize_session=False)
        db.query(ParentChild).filter(ParentChild.parent_id.in_(parent_ids)).delete(synchronize_session=False)
    for p in parents:
        db.delete(p)
    anns = db.query(Announcement).filter(Announcement.title.contains(marker)).all()
    for a in anns:
        db.delete(a)
    # staff notifications created by the test batch (cancel / status)
    db.query(Notification).filter(Notification.title.contains(marker) | Notification.body.contains(marker)).delete(
        synchronize_session=False
    )
    db.commit()
    return {
        "marker": marker,
        "athletes_deleted": len(ids),
        "athlete_ids": ids,
        "events_deleted": deleted_events,
        "parents_deleted": len(parent_ids),
        "announcements_deleted": len(anns),
    }


@router.post("/system/backfill-fees")
def backfill_fees(
    confirm: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    regs = (
        db.query(Registration)
        .filter(Registration.status == "approved", Registration.subscription_fee.isnot(None))
        .all()
    )
    created = 0
    for reg in regs:
        before = (
            db.query(FeeInstallment)
            .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
            .count()
        )
        ensure_subscription_installment(db, reg)
        db.flush()
        after = (
            db.query(FeeInstallment)
            .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
            .count()
        )
        if after > before:
            created += 1
    db.commit()
    return {"registrations": len(regs), "installments_created": created}


@router.post("/system/prune-old-teams")
def prune_old_teams(
    confirm: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime les équipes liées à des catégories hors saison courante, sans memberships actives."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(400, "Aucune saison courante")
    keep_cat_ids = {c.id for c in db.query(Category).filter(Category.season_id == season.id)}
    deleted = []
    kept = []
    for team in db.query(Team).all():
        if team.category_id in keep_cat_ids:
            kept.append(team.id)
            continue
        active = (
            db.query(TeamMembership)
            .filter(TeamMembership.team_id == team.id, TeamMembership.is_active.is_(True))
            .count()
        )
        if active:
            kept.append(team.id)
            continue
        db.query(Event).filter(Event.team_id == team.id).update({Event.team_id: None}, synchronize_session=False)
        db.query(TeamCoach).filter(TeamCoach.team_id == team.id).delete(synchronize_session=False)
        db.query(TeamMembership).filter(TeamMembership.team_id == team.id).delete(synchronize_session=False)
        deleted.append({"id": team.id, "name": team.name, "category_id": team.category_id})
        db.delete(team)
    db.commit()
    return {"season": season.name, "deleted": deleted, "kept_count": len(kept)}


reg_router = APIRouter(prefix="/registrations", tags=["registrations"])


def _reg_out_from_maps(
    reg: Registration,
    athletes: dict[int, Athlete],
    categories: dict[int, Category],
    phones: dict[int, str | None],
    parent_meta: dict | None = None,
) -> RegistrationOut:
    athlete = athletes.get(reg.athlete_id)
    cat = categories.get(reg.category_id) if reg.category_id else None
    return RegistrationOut(
        id=reg.id,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=phones.get(reg.athlete_id),
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
    )


def _reg_out(db: Session, reg: Registration, parent_meta: dict | None = None) -> RegistrationOut:
    athlete = db.get(Athlete, reg.athlete_id)
    cat = db.get(Category, reg.category_id) if reg.category_id else None
    parent_phone = _athlete_parent_phone(db, reg.athlete_id)
    return RegistrationOut(
        id=reg.id,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=parent_phone,
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
    )


def _bulk_parent_phones(db: Session, athlete_ids: list[int]) -> dict[int, str | None]:
    if not athlete_ids:
        return {}
    out: dict[int, str | None] = {aid: None for aid in athlete_ids}
    links = db.query(ParentChild).filter(ParentChild.athlete_id.in_(athlete_ids)).all()
    parent_ids = {l.parent_id for l in links}
    parents = {u.id: u for u in db.query(User).filter(User.id.in_(parent_ids)).all()} if parent_ids else {}
    for link in links:
        parent = parents.get(link.parent_id)
        if parent and parent.phone:
            out[link.athlete_id] = parent.phone
    missing = [aid for aid, phone in out.items() if not phone]
    if missing:
        ecs = db.query(EmergencyContact).filter(EmergencyContact.athlete_id.in_(missing)).all()
        for ec in ecs:
            if out.get(ec.athlete_id) is None:
                out[ec.athlete_id] = ec.phone
    return out


@reg_router.get("", response_model=list[RegistrationOut])
def list_registrations(
    season_id: int | None = None,
    status: str | None = None,
    category_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    limit = min(limit, settings.max_page_size)
    cache_key = f"regs:{user.role}:{user.id}:{season_id}:{status}:{category_id}:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    q = db.query(Registration)
    if season_id:
        q = q.filter(Registration.season_id == season_id)
    if status:
        q = q.filter(Registration.status == status)
    if category_id:
        q = q.filter(Registration.category_id == category_id)
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        q = q.filter(Registration.athlete_id.in_(ids or {-1}))
    rows = q.order_by(Registration.id.desc()).offset(skip).limit(limit).all()
    if not rows:
        cache_set(cache_key, [], 25)
        return []
    athlete_ids = list({r.athlete_id for r in rows})
    cat_ids = list({r.category_id for r in rows if r.category_id})
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()}
    categories = (
        {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    )
    phones = _bulk_parent_phones(db, athlete_ids)
    out = [_reg_out_from_maps(r, athletes, categories, phones) for r in rows]
    cache_set(cache_key, out, 25)
    return out


@reg_router.post("", response_model=RegistrationOut)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    athlete_id = payload.athlete_id
    parent_meta: dict = {}
    birth = payload.athlete.birth_date if payload.athlete else None

    season = db.get(Season, payload.season_id)
    if not season:
        raise HTTPException(400, "Saison introuvable")
    if not season.registration_open and user.role not in {Role.ADMIN, Role.DIRECTION}:
        raise HTTPException(403, "Inscriptions fermées pour cette saison")

    category_id = payload.category_id
    cat: Category | None = db.get(Category, category_id) if category_id else None
    if category_id and not cat:
        raise HTTPException(400, "Catégorie introuvable")
    if cat and cat.season_id != payload.season_id:
        raise HTTPException(400, "Catégorie hors saison sélectionnée")

    # Parent : soit nouvel athlète, soit athlète déjà lié — jamais d'IDOR
    if user.role == Role.PARENT and athlete_id and not payload.athlete:
        if athlete_id not in _parent_athlete_ids(db, user):
            raise HTTPException(403, "Athlète non lié à votre compte")

    if payload.athlete:
        try:
            validate_club_age(payload.athlete.birth_date, required=True)
            validate_category_for_birth(payload.athlete.birth_date, cat)
            if payload.athlete.blood_type is not None:
                payload.athlete.blood_type = validate_blood_type(payload.athlete.blood_type)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        athlete_data = payload.athlete.model_dump(exclude={"parent_phone", "parent_name"})
        if payload.photo_path:
            athlete_data["photo_path"] = payload.photo_path
        if "blood_type" in athlete_data:
            athlete_data["blood_type"] = validate_blood_type(athlete_data.get("blood_type"))
        athlete = Athlete(**athlete_data)
        db.add(athlete)
        db.flush()
        athlete_id = athlete.id
        birth = athlete.birth_date
        if user.role == Role.PARENT:
            db.add(ParentChild(parent_id=user.id, athlete_id=athlete.id))
    if not athlete_id:
        raise HTTPException(400, "Athlète requis")

    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(400, "Athlète introuvable")
    birth = birth or athlete.birth_date

    try:
        validate_club_age(birth, required=True)
        if cat:
            validate_category_for_birth(birth, cat)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    dup = (
        db.query(Registration)
        .filter(Registration.athlete_id == athlete_id, Registration.season_id == payload.season_id)
        .first()
    )
    if dup:
        raise HTTPException(400, "Inscription déjà existante pour cet athlète sur cette saison")

    if payload.photo_path:
        athlete.photo_path = payload.photo_path

    parent_phone = payload.parent_phone or (payload.athlete.parent_phone if payload.athlete else None)
    parent_name = payload.parent_name or (payload.athlete.parent_name if payload.athlete else None)

    if parent_phone and user.role != Role.PARENT:
        try:
            validate_dz_mobile(parent_phone, required=True)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if user.role == Role.PARENT:
        # Lien déjà créé pour nouvel athlète, ou déjà vérifié pour athlète existant
        if not db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete_id).first():
            raise HTTPException(403, "Athlète non lié à votre compte")
    elif parent_phone:
        try:
            parent, temp_pw, created = ensure_parent_account(
                db,
                phone=parent_phone,
                full_name=parent_name,
                athlete_id=athlete_id,
            )
            parent_meta = {"temp_password": temp_pw, "created": created, "phone": parent.phone}
            if payload.parent_password and created:
                parent.password_hash = hash_password(payload.parent_password)
                parent.must_change_password = True
                parent_meta["temp_password"] = payload.parent_password
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if parent_phone or payload.emergency_phone:
        phone = normalize_phone(payload.emergency_phone or parent_phone or "") or (
            payload.emergency_phone or parent_phone
        )
        db.add(
            EmergencyContact(
                athlete_id=athlete_id,
                name=payload.emergency_name or parent_name or "Parent",
                phone=phone or "",
                relation="parent",
            )
        )

    if not category_id and birth:
        year = birth.year
        auto = (
            db.query(Category)
            .filter(
                Category.season_id == payload.season_id,
                Category.birth_year_min <= year,
                Category.birth_year_max >= year,
                Category.is_active.is_(True),
            )
            .first()
        )
        if auto:
            category_id = auto.id
            cat = auto
        else:
            raise HTTPException(
                400,
                f"Aucune catégorie pour l'année {year} sur cette saison. Vérifiez la date de naissance.",
            )
    elif category_id and birth:
        try:
            validate_category_for_birth(birth, cat)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    reg = Registration(
        athlete_id=athlete_id,
        season_id=payload.season_id,
        category_id=category_id,
        registered_on=payload.registered_on or date.today(),
        status="pending" if user.role == Role.PARENT else "approved",
        source=payload.source or ("mobile" if user.role == Role.PARENT else "web"),
        subscription_fee=payload.subscription_fee,
    )
    db.add(reg)
    db.flush()

    if category_id and reg.status == "approved":
        team = db.query(Team).filter(Team.category_id == category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=athlete_id, season_id=payload.season_id
        ).first():
            db.add(
                TeamMembership(
                    team_id=team.id,
                    athlete_id=athlete_id,
                    season_id=payload.season_id,
                )
            )
        ensure_subscription_installment(db, reg)

    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg, parent_meta)


@reg_router.post("/{reg_id}/approve", response_model=RegistrationOut)
def approve_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    athlete = db.get(Athlete, reg.athlete_id)
    cat = db.get(Category, reg.category_id) if reg.category_id else None
    if athlete:
        try:
            validate_club_age(athlete.birth_date, required=True)
            validate_category_for_birth(athlete.birth_date, cat)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    reg.status = "approved"
    if reg.category_id:
        team = db.query(Team).filter(Team.category_id == reg.category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id
        ).first():
            db.add(
                TeamMembership(team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id)
            )
    ensure_subscription_installment(db, reg)
    if athlete:
        notify_parents_of_athlete(
            db,
            athlete.id,
            "Inscription approuvée / تم قبول التسجيل",
            f"{athlete.full_name} — saison validée.",
            kind="registration",
        )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


@reg_router.post("/{reg_id}/reject", response_model=RegistrationOut)
def reject_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    if reg.status == "approved":
        raise HTTPException(400, "Inscription déjà approuvée")
    reg.status = "rejected"
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)
