from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

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
from app.services.fees import ensure_subscription_installment
from app.services.notify import notify_parents_of_athlete, notify_role
from app.services.parents import ensure_parent_account
from app.services.phone import normalize_phone, validate_dz_mobile

TEST_MARKER = "TEST-WRBH-BATCH"
settings = get_settings()

router = APIRouter(tags=["structure"])


@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Season).order_by(Season.starts_on.desc()).all()


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    season_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Category)
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        if current:
            q = q.filter(Category.season_id == current.id)
    return q.order_by(Category.birth_year_min).all()


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
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    athletes = db.query(Athlete).all()
    active = sum(1 for a in athletes if a.status == "Active")
    left = sum(1 for a in athletes if a.status in {"Abandonne", "Left", "Inactif"})
    by_status: dict[str, int] = {}
    for a in athletes:
        by_status[a.status] = by_status.get(a.status, 0) + 1

    cats = []
    classified_ids: set[int] = set()
    if season:
        for cat in db.query(Category).filter(Category.season_id == season.id).order_by(Category.birth_year_min):
            # Comptage principal : année de naissance dans la bande catégorie (Excel + inscriptions)
            birth_q = (
                db.query(Athlete.id)
                .filter(
                    Athlete.birth_date.isnot(None),
                    extract("year", Athlete.birth_date) >= cat.birth_year_min,
                    extract("year", Athlete.birth_date) <= cat.birth_year_max,
                )
            )
            birth_ids = {r[0] for r in birth_q.all()}
            classified_ids |= birth_ids
            birth_count = len(birth_ids)

            team_ids = [t.id for t in db.query(Team).filter(Team.category_id == cat.id)]
            membership_count = 0
            if team_ids:
                membership_count = (
                    db.query(TeamMembership.athlete_id)
                    .filter(
                        TeamMembership.team_id.in_(team_ids),
                        TeamMembership.season_id == season.id,
                        TeamMembership.is_active.is_(True),
                    )
                    .distinct()
                    .count()
                )
            reg_count = (
                db.query(Registration)
                .filter(
                    Registration.season_id == season.id,
                    Registration.category_id == cat.id,
                    Registration.status == "approved",
                )
                .count()
            )
            cats.append(
                {
                    "code": cat.code,
                    "name": cat.name,
                    "name_ar": cat.name_ar,
                    "birth_years": f"{cat.birth_year_min}-{cat.birth_year_max}",
                    "members": birth_count,
                    "by_birth_year": birth_count,
                    "by_membership": membership_count,
                    "by_registration": reg_count,
                }
            )

    unclassified = sum(
        1
        for a in athletes
        if a.birth_date is not None and a.id not in classified_ids and a.status == "Active"
    )
    missing_birth = sum(1 for a in athletes if a.birth_date is None)

    regs_pending = db.query(Registration).filter(Registration.status == "pending").count()
    parents = db.query(User).filter(User.role == Role.PARENT).count()
    return {
        "season": season.name if season else None,
        "athletes_total": len(athletes),
        "athletes_active": active,
        "athletes_left": left,
        "by_status": by_status,
        "categories": cats,
        "unclassified_active": unclassified,
        "missing_birth_date": missing_birth,
        "registrations_pending": regs_pending,
        "parents_count": parents,
    }


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


def _to_athlete_out(
    db: Session,
    athlete: Athlete,
    *,
    parent_phone: str | None = None,
    category_id: int | None = None,
    category_code: str | None = None,
) -> AthleteOut:
    phone = parent_phone if parent_phone is not None else _athlete_parent_phone(db, athlete.id)
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
        photo_path=athlete.photo_path,
        blood_type=getattr(athlete, "blood_type", None),
        parent_phone=phone,
        category_id=category_id,
        category_code=category_code,
    )


def _bulk_athlete_categories(db: Session, athlete_ids: list[int]) -> dict[int, tuple[int | None, str | None]]:
    """Dernière inscription (saison courante si possible) → (category_id, code)."""
    if not athlete_ids:
        return {}
    current = db.query(Season).filter(Season.is_current.is_(True)).first()
    q = db.query(Registration).filter(Registration.athlete_id.in_(athlete_ids))
    if current:
        q = q.filter(Registration.season_id == current.id)
    regs = q.order_by(Registration.id.desc()).all()
    out: dict[int, tuple[int | None, str | None]] = {}
    cat_ids = {r.category_id for r in regs if r.category_id}
    cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    for reg in regs:
        if reg.athlete_id in out:
            continue
        cat = cats.get(reg.category_id) if reg.category_id else None
        out[reg.athlete_id] = (reg.category_id, cat.code if cat else None)
    return out


@athletes_router.get("", response_model=list[AthleteOut])
def list_athletes(
    q: str | None = None,
    status: str | None = Query(None, alias="status"),
    category_id: int | None = None,
    season_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Athlete)
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        query = query.filter(Athlete.id.in_(ids or {-1}))
    if status:
        query = query.filter(Athlete.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(Athlete.full_name.ilike(like))
    if category_id:
        season = season_id
        if not season:
            current = db.query(Season).filter(Season.is_current.is_(True)).first()
            season = current.id if current else None
        subq = db.query(Registration.athlete_id).filter(
            Registration.category_id == category_id,
            Registration.status.in_(["approved", "pending"]),
        )
        if season:
            subq = subq.filter(Registration.season_id == season)
        query = query.filter(Athlete.id.in_(subq))
    limit = min(limit, settings.max_page_size)
    rows = query.order_by(Athlete.full_name).offset(skip).limit(limit).all()
    if not rows:
        return []
    ids = [a.id for a in rows]
    phones = _bulk_parent_phones(db, ids)
    cats = _bulk_athlete_categories(db, ids)
    return [
        _to_athlete_out(
            db,
            a,
            parent_phone=phones.get(a.id),
            category_id=cats.get(a.id, (None, None))[0],
            category_code=cats.get(a.id, (None, None))[1],
        )
        for a in rows
    ]


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
        athlete_photo=athlete.photo_path if athlete else None,
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
        athlete_photo=athlete.photo_path if athlete else None,
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
    limit = min(limit, settings.max_page_size)
    rows = q.order_by(Registration.id.desc()).offset(skip).limit(limit).all()
    if not rows:
        return []
    athlete_ids = list({r.athlete_id for r in rows})
    cat_ids = list({r.category_id for r in rows if r.category_id})
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()}
    categories = (
        {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    )
    phones = _bulk_parent_phones(db, athlete_ids)
    return [_reg_out_from_maps(r, athletes, categories, phones) for r in rows]


@reg_router.post("", response_model=RegistrationOut)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    athlete_id = payload.athlete_id
    parent_meta: dict = {}
    birth = payload.athlete.birth_date if payload.athlete else None

    category_id = payload.category_id
    cat: Category | None = db.get(Category, category_id) if category_id else None
    if category_id and not cat:
        raise HTTPException(400, "Catégorie introuvable")
    if cat and cat.season_id != payload.season_id:
        raise HTTPException(400, "Catégorie hors saison sélectionnée")

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
        if not db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete_id).first():
            db.add(ParentChild(parent_id=user.id, athlete_id=athlete_id))
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
    return _reg_out(db, reg)
