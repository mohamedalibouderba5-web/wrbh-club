"""R0-13 — parent club A ne voit pas les enfants du club B via /mobile/children."""
from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Athlete, Club, ParentChild, Season, User


def test_mobile_children_isolated_by_club():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()

    club_a = Club(name="Club A", acronym="CLA", slug="cluba", status="active", plan="club")
    club_b = Club(name="Club B", acronym="CLB", slug="clubb", status="active", plan="club")
    session.add_all([club_a, club_b])
    session.flush()

    parent_a = User(
        club_id=club_a.id,
        email="parent@a.local",
        full_name="Parent A",
        role="parent",
        password_hash=hash_password("ParentPass123!"),
        must_change_password=False,
    )
    session.add(parent_a)
    for club in (club_a, club_b):
        session.add(
            Season(
                club_id=club.id,
                name="2026/2027",
                starts_on=date(2026, 8, 1),
                ends_on=date(2027, 7, 31),
                is_current=True,
            )
        )
    ath_a = Athlete(club_id=club_a.id, full_name="Enfant A", birth_date=date(2014, 1, 1))
    ath_b = Athlete(club_id=club_b.id, full_name="Enfant B", birth_date=date(2014, 2, 2))
    session.add_all([ath_a, ath_b])
    session.flush()
    # Lien légitime A + lien pollué (même parent_id, club B) — ne doit jamais fuiter
    session.add(ParentChild(parent_id=parent_a.id, athlete_id=ath_a.id, club_id=club_a.id))
    session.add(ParentChild(parent_id=parent_a.id, athlete_id=ath_b.id, club_id=club_b.id))
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    try:
        tok = client.post(
            "/api/v1/auth/login",
            data={
                "username": "parent@a.local",
                "password": "ParentPass123!",
                "club_slug": "cluba",
            },
        ).json()["access_token"]
        res = client.get(
            "/api/v1/mobile/children",
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert res.status_code == 200, res.text
        names = {c["full_name"] for c in res.json()}
        assert names == {"Enfant A"}
        assert "Enfant B" not in names
    finally:
        app.dependency_overrides.clear()
        session.close()
