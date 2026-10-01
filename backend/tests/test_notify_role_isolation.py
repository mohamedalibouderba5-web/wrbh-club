"""A8 — notify_role ne doit jamais notifier un autre club."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.security import hash_password
from app.models import Club, Notification, User
from app.services.notify import notify_role


def test_notify_role_stays_in_club():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()

    club_a = Club(name="Club A", acronym="CA", slug="cluba", status="active")
    club_b = Club(name="Club B", acronym="CB", slug="clubb", status="active")
    db.add_all([club_a, club_b])
    db.flush()

    admin_a = User(
        club_id=club_a.id,
        email="a@t.local",
        full_name="Admin A",
        role="admin",
        password_hash=hash_password("x"),
        is_active=True,
    )
    admin_b = User(
        club_id=club_b.id,
        email="b@t.local",
        full_name="Admin B",
        role="admin",
        password_hash=hash_password("x"),
        is_active=True,
    )
    db.add_all([admin_a, admin_b])
    db.commit()

    n = notify_role(db, "admin", "Titre A", "Corps A", kind="status", club_id=club_a.id)
    db.commit()
    assert n == 1
    notifs = db.query(Notification).all()
    assert len(notifs) == 1
    assert notifs[0].user_id == admin_a.id
    assert notifs[0].club_id == club_a.id
    assert db.query(Notification).filter(Notification.user_id == admin_b.id).count() == 0
