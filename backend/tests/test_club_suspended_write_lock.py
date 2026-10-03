"""R0-07 / B4 — club suspendu : écriture 403, lecture OK."""
from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Club, Season, User


def test_suspended_club_blocks_write_allows_read():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    club = Club(
        name="Club Suspendu",
        acronym="CSU",
        slug="clubsusp",
        status="suspended",
        plan="club",
    )
    session.add(club)
    session.flush()
    admin = User(
        club_id=club.id,
        email="susp@t.local",
        full_name="Admin Susp",
        role="admin",
        password_hash=hash_password("AdminPass123!"),
        must_change_password=False,
    )
    season = Season(
        club_id=club.id,
        name="2026/2027",
        starts_on=date(2026, 8, 1),
        ends_on=date(2027, 7, 31),
        is_current=True,
        registration_open=True,
    )
    session.add_all([admin, season])
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    try:
        tok = client.post(
            "/api/v1/auth/login",
            data={
                "username": "susp@t.local",
                "password": "AdminPass123!",
                "club_slug": "clubsusp",
            },
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {tok}"}
        assert client.get("/api/v1/athletes", headers=headers).status_code == 200
        create = client.post(
            "/api/v1/athletes",
            headers=headers,
            json={"full_name": "Bloqué Suspendu", "birth_date": "2012-01-01"},
        )
        assert create.status_code == 403, create.text
        assert "suspend" in create.json().get("detail", "").lower()
    finally:
        app.dependency_overrides.clear()
        session.close()
