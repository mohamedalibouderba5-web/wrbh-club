from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
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
from app.services.notify import notify_parents_of_athlete, notify_role
from app.services.parents import ensure_parent_account
from app.services.phone import normalize_phone

TEST_MARKER = "TEST-WRBH-BATCH"

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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Team)
    if category_id:
        q = q.filter(Team.category_id == category_id)
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
    if season:
        for cat in db.query(Category).filter(Category.season_id == season.id).order_by(Category.birth_year_min):
            team_ids = [t.id for t in db.query(Team).filter(Team.category_id == cat.id)]
            count = 0
            if team_ids:
                count = (
                    db.query(TeamMembership.athlete_id)
                    .filter(
                        TeamMembership.team_id.in_(team_ids),
                        TeamMembership.season_id == season.id,
                        TeamMembership.is_active.is_(True),
                    )
                    .distinct()
                    .count()
                )
            # also count approved registrations in category
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
                    "members": max(count, reg_count),
                }
            )

    regs_pending = db.query(Registration).filter(Registration.status == "pending").count()
    parents = db.query(User).filter(User.role == Role.PARENT).count()
    return {
        "season": season.name if season else None,
        "athletes_total": len(athletes),
        "athletes_active": active,
        "athletes_left": left,
        "by_status": by_status,
        "categories": cats,
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


def _to_athlete_out(db: Session, athlete: Athlete) -> AthleteOut:
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
        parent_phone=_athlete_parent_phone(db, athlete.id),
    )


@athletes_router.get("", response_model=list[AthleteOut])
def list_athletes(
    q: str | None = None,
    status: str | None = Query(None, alias="status"),
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
    rows = query.order_by(Athlete.full_name).limit(500).all()
    return [_to_athlete_out(db, a) for a in rows]


@athletes_router.post("", response_model=AthleteOut)
def create_athlete(
    payload: AthleteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    data = payload.model_dump(exclude={"parent_phone", "parent_name"})
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
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime tous les athlètes/données marqués pour tests (notes ou nom contenant le marker)."""
    athletes = (
        db.query(Athlete)
        .filter((Athlete.notes.contains(marker)) | (Athlete.full_name.contains("[TEST]")))
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


reg_router = APIRouter(prefix="/registrations", tags=["registrations"])


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


@reg_router.get("", response_model=list[RegistrationOut])
def list_registrations(
    season_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    q = db.query(Registration)
    if season_id:
        q = q.filter(Registration.season_id == season_id)
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        q = q.filter(Registration.athlete_id.in_(ids or {-1}))
    rows = q.order_by(Registration.id.desc()).limit(500).all()
    return [_reg_out(db, r) for r in rows]


@reg_router.post("", response_model=RegistrationOut)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    athlete_id = payload.athlete_id
    parent_meta: dict = {}
    if payload.athlete:
        athlete_data = payload.athlete.model_dump(exclude={"parent_phone", "parent_name"})
        if payload.photo_path:
            athlete_data["photo_path"] = payload.photo_path
        athlete = Athlete(**athlete_data)
        db.add(athlete)
        db.flush()
        athlete_id = athlete.id
        if user.role == Role.PARENT:
            db.add(ParentChild(parent_id=user.id, athlete_id=athlete.id))
    if not athlete_id:
        raise HTTPException(400, "Athlète requis")

    athlete = db.get(Athlete, athlete_id)
    if payload.photo_path and athlete:
        athlete.photo_path = payload.photo_path

    parent_phone = payload.parent_phone or (payload.athlete.parent_phone if payload.athlete else None)
    parent_name = payload.parent_name or (payload.athlete.parent_name if payload.athlete else None)

    if user.role == Role.PARENT:
        # parent connecté : lier son compte (téléphone)
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
    elif user.role == Role.PARENT and athlete_id not in _parent_athlete_ids(db, user):
        if not db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete_id).first():
            raise HTTPException(403, "Athlète non lié")

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

    category_id = payload.category_id
    if not category_id and payload.athlete and payload.athlete.birth_date:
        year = payload.athlete.birth_date.year
        cat = (
            db.query(Category)
            .filter(
                Category.season_id == payload.season_id,
                Category.birth_year_min <= year,
                Category.birth_year_max >= year,
            )
            .first()
        )
        if cat:
            category_id = cat.id

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
        if team:
            db.add(
                TeamMembership(
                    team_id=team.id,
                    athlete_id=athlete_id,
                    season_id=payload.season_id,
                )
            )

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
    reg.status = "approved"
    if reg.category_id:
        team = db.query(Team).filter(Team.category_id == reg.category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id
        ).first():
            db.add(
                TeamMembership(team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id)
            )
    athlete = db.get(Athlete, reg.athlete_id)
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
