from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.models import (
    Announcement,
    Athlete,
    Category,
    Club,
    Convocation,
    Event,
    FeeInstallment,
    ParentChild,
    Registration,
    Season,
    TeamCoach,
    TeamMembership,
    User,
)
from app.schemas import AnnouncementOut, EventOut, MobileAppUpdateOut, MobileChildOut, MobileHomeOut

router = APIRouter(prefix="/mobile", tags=["mobile"])
settings = get_settings()


def _parent_children(db: Session, parent_id: int) -> list[MobileChildOut]:
    links = db.query(ParentChild).filter(ParentChild.parent_id == parent_id).all()
    if not links:
        return []
    current = db.query(Season).filter(Season.is_current.is_(True)).first()
    out: list[MobileChildOut] = []
    for link in links:
        a = db.get(Athlete, link.athlete_id)
        if not a:
            continue
        cat_code = None
        if current:
            reg = (
                db.query(Registration)
                .filter(
                    Registration.athlete_id == a.id,
                    Registration.season_id == current.id,
                    Registration.status.in_(["approved", "pending"]),
                )
                .order_by(Registration.id.desc())
                .first()
            )
            if reg and reg.category_id:
                cat = db.get(Category, reg.category_id)
                cat_code = cat.code if cat else None
        out.append(
            MobileChildOut(
                id=a.id,
                full_name=a.full_name,
                birth_date=a.birth_date,
                status=a.status,
                legacy_number=a.legacy_number,
                blood_type=getattr(a, "blood_type", None),
                photo_path=a.photo_path,
                category_code=cat_code,
            )
        )
    return out


@router.get("/home", response_model=MobileHomeOut)
def mobile_home(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    club_id = getattr(user, "club_id", None)
    club = (
        db.get(Club, club_id) if club_id else db.query(Club).order_by(Club.id).first()
    )
    now = datetime.now(timezone.utc)
    # Planning du mois (~35 jours) pour les parents
    soon = now + timedelta(days=35)

    children: list[MobileChildOut] = []
    children_count = 0
    pending = 0
    unpaid = 0
    events: list[Event] = []

    if user.role == Role.PARENT:
        children = _parent_children(db, user.id)
        athlete_ids = [c.id for c in children]
        children_count = len(athlete_ids)
        pending = (
            db.query(Convocation)
            .filter(Convocation.athlete_id.in_(athlete_ids or {-1}), Convocation.status == "pending")
            .count()
        )
        unpaid = (
            db.query(FeeInstallment)
            .filter(
                FeeInstallment.athlete_id.in_(athlete_ids or {-1}),
                FeeInstallment.status.in_(["due", "partial", "overdue"]),
            )
            .count()
        )
        team_ids = [
            r[0]
            for r in db.query(TeamMembership.team_id).filter(
                TeamMembership.athlete_id.in_(athlete_ids or {-1}),
                TeamMembership.is_active.is_(True),
            )
        ]
        events = (
            db.query(Event)
            .filter(
                Event.team_id.in_(team_ids or {-1}),
                Event.starts_at >= now,
                Event.starts_at <= soon,
                Event.is_cancelled.is_(False),
            )
            .order_by(Event.starts_at)
            .limit(40)
            .all()
        )
    elif user.role == Role.COACH:
        team_ids = {r[0] for r in db.query(TeamCoach.team_id).filter(TeamCoach.user_id == user.id)}
        clauses = [Event.coach_id == user.id, Event.substitute_coach_id == user.id]
        if team_ids:
            clauses.insert(0, Event.team_id.in_(team_ids))
        events = (
            db.query(Event)
            .filter(
                Event.starts_at >= now,
                Event.starts_at <= soon,
                Event.is_cancelled.is_(False),
                or_(*clauses),
            )
            .order_by(Event.starts_at)
            .limit(40)
            .all()
        )
    else:
        eq = db.query(Event).filter(
            Event.starts_at >= now, Event.starts_at <= soon, Event.is_cancelled.is_(False)
        )
        if club_id:
            eq = eq.filter(or_(Event.club_id == club_id, Event.club_id.is_(None)))
        events = eq.order_by(Event.starts_at).limit(40).all()

    audience = ["all"]
    if user.role == Role.PARENT:
        audience.append("parents")
    if user.role == Role.COACH:
        audience.append("coaches")
    ann_q = db.query(Announcement).filter(Announcement.audience.in_(audience))
    if club_id:
        ann_q = ann_q.filter(
            or_(Announcement.club_id == club_id, Announcement.club_id.is_(None))
        )
    anns = ann_q.order_by(Announcement.is_pinned.desc(), Announcement.id.desc()).limit(5).all()

    return MobileHomeOut(
        role=user.role,
        full_name=user.full_name,
        club_name=club.name if club else settings.club_name,
        club_name_ar=club.name_ar if club else settings.club_name_ar,
        children_count=children_count,
        children=children,
        upcoming_events=[EventOut.model_validate(e) for e in events],
        pending_convocations=pending,
        unpaid_installments=unpaid,
        announcements=[AnnouncementOut.model_validate(a) for a in anns],
    )


@router.get("/app-update", response_model=MobileAppUpdateOut)
def mobile_app_update():
    """Version APK recommandée — public (pas de JWT) pour l’écran login aussi."""
    return MobileAppUpdateOut(
        platform="android",
        latest_version=settings.android_app_version,
        latest_version_code=int(settings.android_version_code),
        apk_url=settings.android_apk_url,
        force_update=bool(settings.android_force_update),
        release_notes=settings.android_release_notes,
        release_notes_ar=settings.android_release_notes_ar,
        min_supported_version_code=1,
    )


@router.get("/children", response_model=list[MobileChildOut])
def mobile_children(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != Role.PARENT:
        return []
    return _parent_children(db, user.id)
