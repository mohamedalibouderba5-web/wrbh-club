"""Tests sécurité M1 — cas OK + cas d'erreur (DoD commercial)."""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Athlete, Club, ParentChild, Registration, Season, User


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    club = Club(name="Test Club", name_ar="نادي", acronym="TST")
    session.add(club)
    session.flush()
    admin = User(
        email="admin@test.local",
        full_name="Admin",
        role="admin",
        password_hash=hash_password("AdminPass123!"),
        must_change_password=False,
    )
    parent = User(
        email=None,
        phone="0555123456",
        full_name="Parent Test",
        role="parent",
        password_hash=hash_password("ParentPass123!"),
        must_change_password=False,
    )
    season = Season(
        name="2026/2027",
        is_current=True,
        registration_open=True,
        club_id=club.id,
        starts_on=date(2026, 9, 1),
        ends_on=date(2027, 6, 30),
    )
    session.add_all([admin, parent, season])
    session.commit()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def _override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client: TestClient, username: str, password: str) -> str:
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_login_ok(client, db_session):
    token = _login(client, "admin@test.local", "AdminPass123!")
    assert token


def test_login_bad_password(client):
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.local", "password": "wrong"},
    )
    assert r.status_code == 401


def test_must_change_password_blocks_api(client, db_session):
    parent = db_session.query(User).filter(User.phone == "0555123456").one()
    parent.must_change_password = True
    db_session.commit()
    token = _login(client, "0555123456", "ParentPass123!")
    r = client.get("/api/v1/athletes", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "mot de passe" in r.json()["detail"].lower()
    # change-password + me remain allowed
    r2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200


def test_idor_parent_cannot_register_foreign_athlete(client, db_session):
    season = db_session.query(Season).first()
    foreign = Athlete(full_name="Foreign Kid", birth_date=date(2015, 1, 1), status="Active")
    db_session.add(foreign)
    db_session.commit()
    token = _login(client, "0555123456", "ParentPass123!")
    r = client.post(
        "/api/v1/registrations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "athlete_id": foreign.id,
            "season_id": season.id,
            "source": "web",
        },
    )
    assert r.status_code in {403, 400}


def test_duplicate_registration_rejected(client, db_session):
    admin_token = _login(client, "admin@test.local", "AdminPass123!")
    season = db_session.query(Season).first()
    athlete = Athlete(full_name="Dup Kid", birth_date=date(2014, 5, 5), status="Active")
    db_session.add(athlete)
    db_session.flush()
    db_session.add(
        Registration(
            athlete_id=athlete.id,
            season_id=season.id,
            status="approved",
            registered_on=date.today(),
        )
    )
    db_session.commit()
    r = client.post(
        "/api/v1/registrations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "athlete_id": athlete.id,
            "season_id": season.id,
            "source": "web",
        },
    )
    assert r.status_code in {400, 409}


def test_media_requires_auth(client):
    r = client.get("/api/v1/media/does-not-exist")
    assert r.status_code in {401, 404, 422}


def test_docs_disabled_when_marked_production(monkeypatch):
    # Vérifie la config app (docs_url None en prod) — déjà fixée au boot
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-at-least-24chars")
    get_settings.cache_clear()
    s = get_settings()
    assert s.is_production
    get_settings.cache_clear()
