from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.core.tenant import assert_same_club, get_current_club_id
from app.models import (
    Announcement,
    Athlete,
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
    EventCancelIn,
    EventCreate,
    EventOut,
    EventUpdate,
    RosterAthleteOut,
    ThreadCreate,
    ThreadReplyIn,
)
from app.services.notify import notify_team_parents

router = APIRouter(tags=["agenda"])


def _enrich_convocation(db: Session, conv: Convocation) -> ConvocationOut:
    athlete = db.get(Athlete, conv.athlete_id)
    event = db.get(Event, conv.event_id)
    return ConvocationOut(
        id=conv.id,
        event_id=conv.event_id,
        athlete_id=conv.athlete_id,
        status=conv.status,
        note=conv.note,
        athlete_name=athlete.full_name if athlete else None,
        event_title=event.title if event else None,
        event_starts_at=event.starts_at if event else None,
        event_type=event.event_type if event else None,
    )


def _primary_coach_id(db: Session, team_id: int | None) -> int | None:
    if not team_id:
        return None
    rows = db.query(TeamCoach).filter(TeamCoach.team_id == team_id).all()
    if not rows:
        return None
    for r in rows:
        if r.role_label == "primary":
            return r.user_id
    return rows[0].user_id


def _enrich_event(db: Session, event: Event) -> EventOut:
    out = EventOut.model_validate(event)
    names: dict[int, str] = {}
    ids = [i for i in (event.coach_id, event.substitute_coach_id) if i]
    if ids:
        for u in db.query(User).filter(User.id.in_(ids)).all():
            names[u.id] = u.full_name
    data = out.model_dump()
    data["coach_name"] = names.get(event.coach_id) if event.coach_id else None
    data["substitute_coach_name"] = (
        names.get(event.substitute_coach_id) if event.substitute_coach_id else None
    )
    return EventOut(**data)


@router.get("/events", response_model=list[EventOut])
def list_events(
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    team_id: int | None = None,
    event_type: str | None = None,
    include_cancelled: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(Event).filter(Event.club_id == club_id)
    if not include_cancelled:
        q = q.filter(Event.is_cancelled.is_(False))
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
        # Coach voit aussi les séances où il est titulaire ou remplaçant
        q = q.filter(
            or_(
                Event.team_id.in_(team_ids or {-1}),
                Event.coach_id == user.id,
                Event.substitute_coach_id == user.id,
            )
        )

    rows = q.order_by(Event.starts_at).offset(skip).limit(limit).all()
    return [_enrich_event(db, e) for e in rows]


@router.post("/events", response_model=EventOut)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    data = payload.model_dump()
    if not data.get("coach_id") and data.get("team_id"):
        data["coach_id"] = _primary_coach_id(db, data["team_id"])
    if data.get("substitute_coach_id") and data.get("coach_id") == data.get("substitute_coach_id"):
        raise HTTPException(400, "Le remplaçant doit être différent du coach titulaire")
    event = Event(club_id=club_id, **data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return _enrich_event(db, event)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    assert_same_club(event, club_id)
    if event.is_cancelled:
        raise HTTPException(400, "Séance annulée — modification impossible")
    data = payload.model_dump(exclude_unset=True)
    clear_sub = data.pop("clear_substitute", False)
    for key, val in data.items():
        setattr(event, key, val)
    if clear_sub:
        event.substitute_coach_id = None
    if event.team_id and not event.coach_id:
        event.coach_id = _primary_coach_id(db, event.team_id)
    if event.substitute_coach_id and event.coach_id == event.substitute_coach_id:
        raise HTTPException(400, "Le remplaçant doit être différent du coach titulaire")
    db.commit()
    db.refresh(event)
    return _enrich_event(db, event)


@router.post("/events/{event_id}/convocations", response_model=list[ConvocationOut])
def create_convocations(
    event_id: int,
    athlete_ids: list[int],
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    assert_same_club(event, club_id)
    created = []
    for aid in athlete_ids:
        athlete = db.get(Athlete, aid)
        if not athlete:
            raise HTTPException(404, "Athlète introuvable")
        assert_same_club(athlete, club_id)
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
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(Convocation).join(Event, Event.id == Convocation.event_id).filter(Event.club_id == club_id)
    if event_id:
        q = q.filter(Convocation.event_id == event_id)
    if status:
        q = q.filter(Convocation.status == status)
    if user.role == Role.PARENT:
        ids = {r[0] for r in db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id)}
        q = q.filter(Convocation.athlete_id.in_(ids or {-1}))
    rows = q.order_by(Convocation.id.desc()).limit(200).all()
    return [_enrich_convocation(db, c) for c in rows]


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
    return _enrich_convocation(db, conv)


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    assert_same_club(event, club_id)
    return _enrich_event(db, event)


@router.post("/events/{event_id}/cancel", response_model=EventOut)
def cancel_event(
    event_id: int,
    payload: EventCancelIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    assert_same_club(event, club_id)
    event.is_cancelled = True
    reason = payload.reason or "Séance annulée"
    if event.description:
        event.description = f"{event.description}\n[Annulé] {reason}"
    else:
        event.description = f"[Annulé] {reason}"
    notified = 0
    if payload.notify and event.team_id:
        when = event.starts_at.strftime("%d/%m/%Y %H:%M")
        notified = notify_team_parents(
            db,
            event.team_id,
            f"Séance annulée / إلغاء الحصة — {event.title}",
            f"{when} — {reason}",
            kind="cancel",
        )
    db.commit()
    db.refresh(event)
    return _enrich_event(db, event)


@router.get("/events/{event_id}/roster", response_model=list[RosterAthleteOut])
def event_roster(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    if not event.team_id:
        return []
    memberships = (
        db.query(TeamMembership)
        .filter(TeamMembership.team_id == event.team_id, TeamMembership.is_active.is_(True))
        .all()
    )
    out: list[RosterAthleteOut] = []
    for m in memberships:
        athlete = db.get(Athlete, m.athlete_id)
        if not athlete or athlete.status != "Active":
            continue
        att = db.query(Attendance).filter_by(event_id=event_id, athlete_id=athlete.id).first()
        out.append(
            RosterAthleteOut(
                athlete_id=athlete.id,
                full_name=athlete.full_name,
                photo_path=athlete.photo_path,
                attendance_status=att.status if att else None,
                jersey_number=m.jersey_number,
            )
        )
    return sorted(out, key=lambda x: x.full_name)


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
def list_announcements(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    q = (
        db.query(Announcement)
        .filter(Announcement.club_id == club_id)
        .order_by(Announcement.is_pinned.desc(), Announcement.id.desc())
    )
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
    club_id: int = Depends(get_current_club_id),
):
    ann = Announcement(
        club_id=club_id,
        author_id=user.id,
        published_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@comms_router.get("/notifications")
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.id.desc())
        .offset(skip)
        .limit(limit)
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
    payload: ThreadCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    subject = (payload.subject or "").strip()
    body = (payload.body or "").strip()
    if not subject or not body:
        raise HTTPException(400, "Sujet et message requis")
    if payload.athlete_id:
        athlete = db.get(Athlete, payload.athlete_id)
        if not athlete:
            raise HTTPException(404, "Athlète introuvable")
        assert_same_club(athlete, club_id)
    thread = MessageThread(
        club_id=club_id,
        subject=subject[:200],
        created_by=user.id,
        athlete_id=payload.athlete_id,
    )
    db.add(thread)
    db.flush()
    db.add(Message(club_id=club_id, thread_id=thread.id, sender_id=user.id, body=body))
    db.commit()
    return {"id": thread.id, "subject": thread.subject, "status": thread.status}


@comms_router.get("/threads")
def list_threads(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    club_threads = db.query(MessageThread).filter(MessageThread.club_id == club_id)
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH}:
        threads = club_threads.order_by(MessageThread.id.desc()).limit(100).all()
    else:
        threads = (
            club_threads.filter(MessageThread.created_by == user.id)
            .order_by(MessageThread.id.desc())
            .limit(100)
            .all()
        )
    out = []
    for t in threads:
        last = (
            db.query(Message)
            .filter(Message.thread_id == t.id)
            .order_by(Message.id.desc())
            .first()
        )
        creator = db.get(User, t.created_by)
        out.append(
            {
                "id": t.id,
                "subject": t.subject,
                "status": t.status,
                "athlete_id": t.athlete_id,
                "created_by": t.created_by,
                "created_by_name": creator.full_name if creator else None,
                "last_message": last.body if last else None,
                "updated_at": last.created_at if last else t.created_at,
            }
        )
    return out


def _can_access_thread(db: Session, user: User, thread: MessageThread) -> bool:
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH}:
        return True
    return thread.created_by == user.id


@comms_router.get("/threads/{thread_id}")
def get_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    thread = db.get(MessageThread, thread_id)
    if not thread:
        raise HTTPException(404, "Fil introuvable")
    assert_same_club(thread, club_id)
    if not _can_access_thread(db, user, thread):
        raise HTTPException(404, "Fil introuvable")
    msgs = (
        db.query(Message)
        .filter(Message.thread_id == thread_id)
        .order_by(Message.id.asc())
        .all()
    )
    sender_ids = {m.sender_id for m in msgs}
    names = {
        u.id: u.full_name
        for u in db.query(User).filter(User.id.in_(sender_ids or {-1})).all()
    }
    return {
        "id": thread.id,
        "subject": thread.subject,
        "status": thread.status,
        "athlete_id": thread.athlete_id,
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": names.get(m.sender_id),
                "body": m.body,
                "created_at": m.created_at,
                "is_mine": m.sender_id == user.id,
            }
            for m in msgs
        ],
    }


@comms_router.post("/threads/{thread_id}/messages")
def reply_thread(
    thread_id: int,
    payload: ThreadReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    thread = db.get(MessageThread, thread_id)
    if not thread:
        raise HTTPException(404, "Fil introuvable")
    assert_same_club(thread, club_id)
    if not _can_access_thread(db, user, thread):
        raise HTTPException(404, "Fil introuvable")
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(400, "Message vide")
    msg = Message(club_id=club_id, thread_id=thread.id, sender_id=user.id, body=body)
    db.add(msg)
    if thread.status == "closed":
        thread.status = "open"
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": user.full_name,
        "body": msg.body,
        "created_at": msg.created_at,
        "is_mine": True,
    }
