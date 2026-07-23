from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.models import (
    Announcement,
    Attendance,
    Club,
    Convocation,
    Event,
    Message,
    MessageThread,
    Notification,
    ParentChild,
    PushToken,
    TeamCoach,
    TeamMembership,
    User,
)
from app.schemas import (
    AnnouncementCreate,
    AnnouncementOut,
    AttendanceIn,
    ConvocationOut,
    EventCreate,
    EventOut,
)

router = APIRouter(tags=["agenda"])


@router.get("/events", response_model=list[EventOut])
def list_events(
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    team_id: int | None = None,
    event_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Event).filter(Event.is_cancelled.is_(False))
    if from_dt:
        q = q.filter(Event.starts_at >= from_dt)
    if to_dt:
        q = q.filter(Event.starts_at <= to_dt)
    if team_id:
        q = q.filter(Event.team_id == team_id)
    if event_type:
        q = q.filter(Event.event_type == event_type)

    if user.role == Role.PARENT:
        athlete_ids = {
            r[0] for r in db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id)
        }
        team_ids = {
            r[0]
            for r in db.query(TeamMembership.team_id).filter(
                TeamMembership.athlete_id.in_(athlete_ids or {-1}),
                TeamMembership.is_active.is_(True),
            )
        }
        q = q.filter(Event.team_id.in_(team_ids or {-1}))
    elif user.role == Role.COACH:
        team_ids = {r[0] for r in db.query(TeamCoach.team_id).filter(TeamCoach.user_id == user.id)}
        q = q.filter(Event.team_id.in_(team_ids or {-1}))

    return q.order_by(Event.starts_at).limit(300).all()


@router.post("/events", response_model=EventOut)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
):
    club = db.query(Club).first()
    event = Event(club_id=club.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.post("/events/{event_id}/convocations", response_model=list[ConvocationOut])
def create_convocations(
    event_id: int,
    athlete_ids: list[int],
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    created = []
    for aid in athlete_ids:
        existing = db.query(Convocation).filter_by(event_id=event_id, athlete_id=aid).first()
        if existing:
            created.append(existing)
            continue
        c = Convocation(event_id=event_id, athlete_id=aid)
        db.add(c)
        created.append(c)
    db.commit()
    for c in created:
        db.refresh(c)
    return created


@router.get("/convocations", response_model=list[ConvocationOut])
def list_convocations(
    event_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Convocation)
    if event_id:
        q = q.filter(Convocation.event_id == event_id)
    if user.role == Role.PARENT:
        ids = {r[0] for r in db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id)}
        q = q.filter(Convocation.athlete_id.in_(ids or {-1}))
    return q.order_by(Convocation.id.desc()).limit(200).all()


@router.post("/convocations/{conv_id}/respond", response_model=ConvocationOut)
def respond_convocation(
    conv_id: int,
    status: str = Query(..., pattern="^(confirmed|declined|excused)$"),
    note: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = db.get(Convocation, conv_id)
    if not conv:
        raise HTTPException(404, "Convocation introuvable")
    if user.role == Role.PARENT:
        link = (
            db.query(ParentChild)
            .filter_by(parent_id=user.id, athlete_id=conv.athlete_id)
            .first()
        )
        if not link:
            raise HTTPException(403, "Accès refusé")
    conv.status = status
    conv.note = note
    conv.responded_at = datetime.now(timezone.utc)
    conv.responded_by = user.id
    db.commit()
    db.refresh(conv)
    return conv


@router.post("/events/{event_id}/attendance")
def mark_attendance(
    event_id: int,
    items: list[AttendanceIn],
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
):
    if not db.get(Event, event_id):
        raise HTTPException(404, "Événement introuvable")
    results = []
    for item in items:
        row = db.query(Attendance).filter_by(event_id=event_id, athlete_id=item.athlete_id).first()
        if not row:
            row = Attendance(event_id=event_id, athlete_id=item.athlete_id)
            db.add(row)
        row.status = item.status
        row.note = item.note
        row.marked_by = user.id
        results.append(row)
    db.commit()
    return {"saved": len(results)}


comms_router = APIRouter(tags=["communication"])


@comms_router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Announcement).order_by(Announcement.is_pinned.desc(), Announcement.id.desc())
    if user.role == Role.PARENT:
        q = q.filter(Announcement.audience.in_(["all", "parents"]))
    elif user.role == Role.COACH:
        q = q.filter(Announcement.audience.in_(["all", "coaches"]))
    return q.limit(50).all()


@comms_router.post("/announcements", response_model=AnnouncementOut)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    club = db.query(Club).first()
    ann = Announcement(
        club_id=club.id,
        author_id=user.id,
        published_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@comms_router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.id.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "kind": n.kind,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in rows
    ]


@comms_router.post("/push-tokens")
def register_push(
    token: str,
    platform: str = "unknown",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(PushToken).filter_by(user_id=user.id, token=token).first()
    if not existing:
        db.add(PushToken(user_id=user.id, token=token, platform=platform))
        db.commit()
    return {"ok": True}


@comms_router.post("/threads")
def create_thread(
    subject: str,
    body: str,
    athlete_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    thread = MessageThread(subject=subject, created_by=user.id, athlete_id=athlete_id)
    db.add(thread)
    db.flush()
    db.add(Message(thread_id=thread.id, sender_id=user.id, body=body))
    db.commit()
    return {"id": thread.id, "subject": thread.subject}


@comms_router.get("/threads")
def list_threads(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF}:
        threads = db.query(MessageThread).order_by(MessageThread.id.desc()).limit(100).all()
    else:
        threads = (
            db.query(MessageThread)
            .filter(MessageThread.created_by == user.id)
            .order_by(MessageThread.id.desc())
            .limit(100)
            .all()
        )
    return [{"id": t.id, "subject": t.subject, "status": t.status, "athlete_id": t.athlete_id} for t in threads]
