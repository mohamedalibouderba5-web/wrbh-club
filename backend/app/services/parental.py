"""Suivi parental — notifications filtrées par préférences (norme TeamSnap/Heja)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Athlete, Event, ParentChild, ParentNotificationPref, TeamMembership, User
from app.services.notify import notify_parents_of_athlete, notify_team_parents, notify_user

ATTENDANCE_LABELS = {
    "present": ("présent", "حاضر"),
    "absent": ("absent", "غائب"),
    "late": ("en retard", "متأخر"),
    "excused": ("excusé", "معذور"),
}

EVENT_TYPE_LABELS = {
    "training": ("Entraînement", "تدريب"),
    "match": ("Match", "مباراة"),
    "meeting": ("Réunion", "اجتماع"),
    "camp": ("Stage", "معسكر"),
    "gala": ("Gala", "حفل"),
    "other": ("Événement", "حدث"),
}


def get_or_create_parent_prefs(db: Session, user_id: int, club_id: int | None = None) -> ParentNotificationPref:
    row = db.query(ParentNotificationPref).filter(ParentNotificationPref.user_id == user_id).first()
    if row:
        return row
    row = ParentNotificationPref(user_id=user_id, club_id=club_id)
    db.add(row)
    db.flush()
    return row


def parent_allows(db: Session, parent_id: int, flag: str) -> bool:
    prefs = db.query(ParentNotificationPref).filter(ParentNotificationPref.user_id == parent_id).first()
    if not prefs:
        return True
    return bool(getattr(prefs, flag, True))


def _fmt_when(dt: datetime | None) -> str:
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone()
    return local.strftime("%d/%m/%Y %H:%M")


def event_headline(event: Event) -> str:
    fr, ar = EVENT_TYPE_LABELS.get(event.event_type, EVENT_TYPE_LABELS["other"])
    return f"{fr} / {ar} — {event.title}"


def event_body(event: Event, extra: str = "") -> str:
    when = _fmt_when(event.starts_at)
    loc = event.location_text or "Lieu à confirmer / المكان يؤكد لاحقاً"
    parts = [f"{when}", f"📍 {loc}"]
    if extra:
        parts.append(extra)
    return " · ".join(parts)


def notify_team_parents_filtered(
    db: Session,
    team_id: int,
    title: str,
    body: str,
    kind: str,
    pref_flag: str,
) -> int:
    athlete_ids = [
        r[0]
        for r in db.query(TeamMembership.athlete_id).filter(
            TeamMembership.team_id == team_id,
            TeamMembership.is_active.is_(True),
        )
    ]
    count = 0
    for aid in athlete_ids:
        parent_ids = [
            r[0] for r in db.query(ParentChild.parent_id).filter(ParentChild.athlete_id == aid)
        ]
        for pid in parent_ids:
            if parent_allows(db, pid, pref_flag):
                notify_user(db, pid, title, body, kind=kind)
                count += 1
    return count


def notify_event_created(db: Session, event: Event) -> int:
    if event.approval_status != "approved" or event.is_cancelled:
        return 0
    from app.services.broadcast import fanout_session_lifecycle

    club_id = int(event.club_id) if event.club_id else None
    staff_n = 0
    if club_id:
        counts = fanout_session_lifecycle(db, club_id=club_id, event=event, action="create")
        staff_n = int(counts.get("managers", 0)) + int(counts.get("coaches", 0))
    parents_n = 0
    if event.notify_parents and event.team_id:
        parents_n = notify_team_parents_filtered(
            db,
            event.team_id,
            f"Nouvelle séance / حصة جديدة — {event_headline(event)}",
            event_body(event, "Vous serez informés du début, des absences et de la fin."),
            kind="session_create",
            pref_flag="notify_on_create",
        )
    return parents_n + staff_n


def notify_event_started(db: Session, event: Event) -> int:
    if not event.notify_parents or not event.team_id:
        return 0
    return notify_team_parents_filtered(
        db,
        event.team_id,
        f"Séance en cours / الحصة جارية — {event.title}",
        event_body(event, "La séance a démarré. Suivi sécurité enfant activé."),
        kind="session_start",
        pref_flag="notify_on_start",
    )


def notify_event_completed(db: Session, event: Event) -> int:
    if not event.notify_parents or not event.team_id:
        return 0
    return notify_team_parents_filtered(
        db,
        event.team_id,
        f"Séance terminée / انتهت الحصة — {event.title}",
        event_body(event, "La séance est clôturée. Votre enfant a été pris en charge jusqu’à la fin."),
        kind="session_end",
        pref_flag="notify_on_end",
    )


def notify_attendance_change(
    db: Session,
    event: Event,
    athlete_id: int,
    status: str,
) -> int:
    if not event.notify_parents:
        return 0
    athlete = db.get(Athlete, athlete_id)
    name = athlete.full_name if athlete else f"#{athlete_id}"
    fr, ar = ATTENDANCE_LABELS.get(status, (status, status))
    title = f"Présence / الحضور — {name}"
    body = event_body(event, f"Signalé : {fr} / {ar}")
    parent_ids = [
        r[0] for r in db.query(ParentChild.parent_id).filter(ParentChild.athlete_id == athlete_id)
    ]
    n = 0
    for pid in parent_ids:
        if parent_allows(db, pid, "notify_on_attendance"):
            notify_user(db, pid, title, body, kind="attendance")
            n += 1
    return n


def send_due_reminders(
    db: Session, now: datetime | None = None, club_id: int | None = None
) -> dict:
    """Rappels 1× (minutes avant) et veille — bornés au `club_id` si fourni."""
    now = now or datetime.now(timezone.utc)
    sent_min = 0
    sent_day = 0
    q = db.query(Event).filter(
        Event.is_cancelled.is_(False),
        Event.notify_parents.is_(True),
        Event.approval_status == "approved",
        Event.session_status == "scheduled",
        Event.starts_at >= now,
        Event.starts_at <= now + timedelta(days=2),
    )
    if club_id is not None:
        q = q.filter(Event.club_id == club_id)
    events = q.all()
    for event in events:
        if not event.team_id:
            continue
        eid_club = int(event.club_id)
        athlete_ids = [
            r[0]
            for r in db.query(TeamMembership.athlete_id).filter(
                TeamMembership.team_id == event.team_id,
                TeamMembership.is_active.is_(True),
                TeamMembership.club_id == eid_club,
            )
        ]
        for aid in athlete_ids:
            for (pid,) in db.query(ParentChild.parent_id).filter(
                ParentChild.athlete_id == aid,
                ParentChild.club_id == eid_club,
            ):
                prefs = get_or_create_parent_prefs(db, pid, eid_club)
                starts = event.starts_at
                if starts.tzinfo is None:
                    starts = starts.replace(tzinfo=timezone.utc)
                delta = starts - now
                # rappel X minutes
                mins = int(prefs.remind_minutes_before or 0)
                if mins > 0:
                    target = timedelta(minutes=mins)
                    if abs((delta - target).total_seconds()) <= 7 * 60:
                        notify_user(
                            db,
                            pid,
                            f"Rappel / تذكير — {event.title}",
                            event_body(event, f"Dans environ {mins} minutes"),
                            kind="reminder",
                        )
                        sent_min += 1
                # veille (entre 22h et 26h avant)
                if prefs.remind_day_before:
                    hours = delta.total_seconds() / 3600
                    if 22 <= hours <= 26:
                        notify_user(
                            db,
                            pid,
                            f"Rappel J-1 / تذكير قبل يوم — {event.title}",
                            event_body(event, "Séance demain"),
                            kind="reminder",
                        )
                        sent_day += 1
    db.commit()
    return {"reminders_minutes": sent_min, "reminders_day_before": sent_day}
