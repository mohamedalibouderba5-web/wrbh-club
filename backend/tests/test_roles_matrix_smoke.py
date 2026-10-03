"""C2 — échantillon matrice rôles : parent hors Finance/Matériel/Comptes."""
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


def _ctx():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    club = Club(name="Club Roles", acronym="CRL", slug="clubroles", status="active", plan="club")
    session.add(club)
    session.flush()
    for email, role in (
        ("admin@r.local", "admin"),
        ("parent@r.local", "parent"),
        ("coach@r.local", "coach"),
    ):
        session.add(
            User(
                club_id=club.id,
                email=email,
                full_name=role,
                role=role,
                password_hash=hash_password("RolePass123!"),
                must_change_password=False,
            )
        )
    session.add(
        Season(
            club_id=club.id,
            name="2026/2027",
            starts_on=date(2026, 8, 1),
            ends_on=date(2027, 7, 31),
            is_current=True,
        )
    )
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    return client, session


def _tok(client: TestClient, email: str) -> str:
    return client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "RolePass123!", "club_slug": "clubroles"},
    ).json()["access_token"]


def test_parent_forbidden_on_finance_inventory_users():
    client, session = _ctx()
    try:
        h = {"Authorization": f"Bearer {_tok(client, 'parent@r.local')}"}
        # Finance settings = montants inscription (lecture OK) ; module Finance/ledger/paiements = non
        assert client.get("/api/v1/ledger", headers=h).status_code == 403
        assert client.get("/api/v1/payments/recent", headers=h).status_code == 403
        assert client.get("/api/v1/inventory/items", headers=h).status_code == 403
        assert client.get("/api/v1/auth/users", headers=h).status_code == 403
        assert client.get("/api/v1/mobile/children", headers=h).status_code == 200
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_coach_cannot_create_athlete_or_manage_users():
    client, session = _ctx()
    try:
        h = {"Authorization": f"Bearer {_tok(client, 'coach@r.local')}"}
        create = client.post(
            "/api/v1/athletes",
            headers=h,
            json={"full_name": "X", "birth_date": "2012-01-01"},
        )
        assert create.status_code == 403, create.text
        assert client.get("/api/v1/auth/users", headers=h).status_code == 403
        assert client.get("/api/v1/teams", headers=h).status_code == 200
    finally:
        app.dependency_overrides.clear()
        session.close()
