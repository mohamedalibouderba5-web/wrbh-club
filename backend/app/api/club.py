from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.models import (
    Athlete,
    Category,
    Discipline,
    EmergencyContact,
    ParentChild,
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
    CategoryOut,
    RegistrationCreate,
    RegistrationOut,
    SeasonOut,
    TeamOut,
)

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


athletes_router = APIRouter(prefix="/athletes", tags=["athletes"])


def _parent_athlete_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id).all()
    return {r[0] for r in rows}


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
    return query.order_by(Athlete.full_name).limit(500).all()


@athletes_router.post("", response_model=AthleteOut)
def create_athlete(
    payload: AthleteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    athlete = Athlete(**payload.model_dump())
    db.add(athlete)
    db.commit()
    db.refresh(athlete)
    return athlete


@athletes_router.get("/{athlete_id}", response_model=AthleteOut)
def get_athlete(athlete_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    if user.role == Role.PARENT and athlete_id not in _parent_athlete_ids(db, user):
        raise HTTPException(403, "Accès refusé")
    return athlete


reg_router = APIRouter(prefix="/registrations", tags=["registrations"])


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
    return q.order_by(Registration.id.desc()).limit(500).all()


@reg_router.post("", response_model=RegistrationOut)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    athlete_id = payload.athlete_id
    if payload.athlete:
        athlete = Athlete(**payload.athlete.model_dump())
        db.add(athlete)
        db.flush()
        athlete_id = athlete.id
        if user.role == Role.PARENT:
            db.add(ParentChild(parent_id=user.id, athlete_id=athlete.id))
    if not athlete_id:
        raise HTTPException(400, "Athlète requis")
    if user.role == Role.PARENT and athlete_id not in _parent_athlete_ids(db, user):
        # newly linked above, re-check
        if not db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete_id).first():
            raise HTTPException(403, "Athlète non lié")

    if payload.emergency_name and payload.emergency_phone:
        db.add(
            EmergencyContact(
                athlete_id=athlete_id,
                name=payload.emergency_name,
                phone=payload.emergency_phone,
            )
        )

    # auto category from birth year if missing
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
    return reg


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
    db.commit()
    db.refresh(reg)
    return reg
