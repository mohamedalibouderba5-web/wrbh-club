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
) -> Notification:
    n = Notification(user_id=user_id, title=title, body=body, kind=kind, link=link)
    db.add(n)
    return n


def notify_parents_of_athlete(
    db: Session,
    athlete_id: int,
    title: str,
    body: str,
    kind: str = "info",
) -> int:
    parent_ids = [
        r[0] for r in db.query(ParentChild.parent_id).filter(ParentChild.athlete_id == athlete_id)
    ]
    for pid in parent_ids:
        notify_user(db, pid, title, body, kind=kind)
    return len(parent_ids)


def notify_team_parents(
    db: Session,
    team_id: int,
    title: str,
    body: str,
    kind: str = "info",
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
        count += notify_parents_of_athlete(db, aid, title, body, kind=kind)
    return count


def notify_role(db: Session, role: str, title: str, body: str, kind: str = "info") -> int:
    users = db.query(User).filter(User.role == role, User.is_active.is_(True)).all()
    for u in users:
        notify_user(db, u.id, title, body, kind=kind)
    return len(users)
