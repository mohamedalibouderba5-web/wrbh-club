"""Console plateforme — dashboard / présence / clubs (superadmin)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Athlete, Club, User


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

    club_a = Club(name="Club A", name_ar="أ", acronym="CA", slug="club-a", status="active", plan="club")
    club_b = Club(
        name="Club B",
        name_ar="ب",
        acronym="CB",
        slug="club-b",
        status="suspended",
        plan="discovery",
        trial_ends_on=date.today() + timedelta(days=3),
    )
    session.add_all([club_a, club_b])
    session.flush()

    sa = User(
        club_id=None,
        email="platform@test.local",
        full_name="Platform",
        role="superadmin",
        password_hash=hash_password("PlatformPass123!"),
        must_change_password=False,
        last_seen_at=datetime.now(timezone.utc),
    )
    admin = User(
        club_id=club_a.id,
        email="admin-a@test.local",
        full_name="Admin A",
        role="admin",
        password_hash=hash_password("AdminPass123!"),
        must_change_password=False,
        last_seen_at=datetime.now(timezone.utc),
    )
    parent = User(
        club_id=club_a.id,
        email=None,
        phone="0555000111",
        full_name="Parent A",
        role="parent",
        password_hash=hash_password("ParentPass123!"),
        must_change_password=False,
        last_seen_at=datetime.now(timezone.utc),
    )
    offline = User(
        club_id=club_b.id,
        email="staff-b@test.local",
        full_name="Staff B",
        role="staff",
        password_hash=hash_password("StaffPass123!"),
        must_change_password=False,
        last_seen_at=datetime.now(timezone.utc) - timedelta(hours=5),
    )
    athlete = Athlete(
        club_id=club_a.id,
        full_name="Athlete A",
        birth_date=date(2014, 1, 1),
        status="Active",
    )
    session.add_all([sa, admin, parent, offline, athlete])
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


def _tok(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_dashboard_superadmin_ok(client: TestClient):
    tok = _tok(client, "platform@test.local", "PlatformPass123!")
    res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["clubs"]["total"] == 2
    assert data["clubs"]["suspended"] == 1
    assert data["users"]["online"] >= 3
    assert data["users"]["online_by_role"].get("parent", 0) >= 1
    assert data["activity"]["athletes_total"] == 1
    assert isinstance(data["online_users"], list)
    assert isinstance(data["recent_clubs"], list)


def test_dashboard_forbidden_for_club_admin(client: TestClient):
    tok = _tok(client, "admin-a@test.local", "AdminPass123!")
    res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 403


def test_users_online_filter(client: TestClient):
    tok = _tok(client, "platform@test.local", "PlatformPass123!")
    res = client.get(
        "/api/v1/admin/users?online_only=true&role=parent",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    assert all(i["role"] == "parent" and i["online"] for i in items)


def test_patch_club_and_user(client: TestClient, db_session):
    tok = _tok(client, "platform@test.local", "PlatformPass123!")
    club_b = db_session.query(Club).filter(Club.slug == "club-b").one()
    res = client.patch(
        f"/api/v1/admin/clubs/{club_b.id}",
        headers={"Authorization": f"Bearer {tok}"},
        json={"status": "active", "plan": "club"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "active"
    assert body["plan"] == "club"

    parent = db_session.query(User).filter(User.full_name == "Parent A").one()
    res2 = client.patch(
        f"/api/v1/admin/users/{parent.id}",
        headers={"Authorization": f"Bearer {tok}"},
        json={"is_active": False},
    )
    assert res2.status_code == 200
    assert res2.json()["is_active"] is False
