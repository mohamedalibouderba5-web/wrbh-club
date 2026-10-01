from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Notification, ParentChild, TeamMembership, User


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    kind: str = "info",
    link: str | None = None,
    club_id: int | None = None,
) -> Notification:
    # Si club_id omis, le prendre du destinataire (évite NULL → fuite multi-tenant)
    cid = club_id
    if cid is None:
        u = db.get(User, user_id)
        cid = getattr(u, "club_id", None) if u else None
    n = Notification(
        user_id=user_id,
        title=title,
        body=body,
        kind=kind,
        link=link,
        club_id=cid,
    )
    db.add(n)
    return n


def notify_parents_of_athlete(
    db: Session,
    athlete_id: int,
    title: str,
    body: str,
    kind: str = "info",
    club_id: int | None = None,
) -> int:
    parent_ids = [
        r[0] for r in db.query(ParentChild.parent_id).filter(ParentChild.athlete_id == athlete_id)
    ]
    for pid in parent_ids:
        notify_user(db, pid, title, body, kind=kind, club_id=club_id)
    return len(parent_ids)


def notify_team_parents(
    db: Session,
    team_id: int,
    title: str,
    body: str,
    kind: str = "info",
    club_id: int | None = None,
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
        count += notify_parents_of_athlete(db, aid, title, body, kind=kind, club_id=club_id)
    return count


def notify_role(
    db: Session,
    role: str,
    title: str,
    body: str,
    kind: str = "info",
    *,
    club_id: int,
) -> int:
    """Notifie les utilisateurs d'un rôle — **toujours** scopé au club (A8)."""
    if not club_id:
        raise ValueError("notify_role exige club_id (isolation multi-tenant)")
    users = (
        db.query(User)
        .filter(User.role == role, User.is_active.is_(True), User.club_id == club_id)
        .all()
    )
    for u in users:
        notify_user(db, u.id, title, body, kind=kind, club_id=club_id)
    return len(users)
