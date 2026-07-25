"""Tests d'étanchéité multi-tenant (Chantier 1 — Incrément 1, DoD #7).

Deux clubs fictifs A et B. Un admin du club A ne doit JAMAIS pouvoir lire /
modifier / supprimer une ressource du club B (réponse 404), ni la voir dans
les listes.
"""
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
from app.models import (
    Athlete,
    Club,
    Event,
    InventoryItem,
    LedgerEntry,
    Season,
    User,
)


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

    club_a = Club(name="Club A", name_ar="نادي أ", acronym="CLA", slug="cluba", status="active")
    club_b = Club(name="Club B", name_ar="نادي ب", acronym="CLB", slug="clubb", status="active")
    session.add_all([club_a, club_b])
    session.flush()

    def _admin(email: str, club_id: int) -> User:
        return User(
            club_id=club_id,
            email=email,
            full_name=f"Admin {club_id}",
            role="admin",
            password_hash=hash_password("AdminPass123!"),
            must_change_password=False,
        )

    admin_a = _admin("admin@a.local", club_a.id)
    admin_b = _admin("admin@b.local", club_b.id)
    session.add_all([admin_a, admin_b])

    now = datetime.now(timezone.utc)
    for club in (club_a, club_b):
        season = Season(
            name="2026/2027",
            is_current=True,
            registration_open=True,
            club_id=club.id,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 6, 30),
        )
        session.add(season)
        session.flush()
        session.add(
            Athlete(
                club_id=club.id,
                full_name=f"Joueur {club.acronym}",
                birth_date=date(2014, 5, 5),
                status="Active",
            )
        )
        session.add(
            Event(
                club_id=club.id,
                season_id=season.id,
                event_type="training",
                title=f"Séance {club.acronym}",
                starts_at=now + timedelta(days=1),
            )
        )
        session.add(
            LedgerEntry(
                club_id=club.id,
                entry_type="income",
                category="subscription",
                label=f"Recette {club.acronym}",
                amount=1000,
                entry_date=date.today(),
            )
        )
        session.add(
            InventoryItem(club_id=club.id, name=f"Ballon {club.acronym}", quantity=10)
        )
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


def _login(client: TestClient, username: str) -> str:
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "AdminPass123!"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _ids(db, model, club_id):
    return [row.id for row in db.query(model).filter(model.club_id == club_id).all()]


def test_token_contains_club_id(client, db_session):
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@a.local", "password": "AdminPass123!"},
    )
    assert r.status_code == 200
    club_a = db_session.query(Club).filter(Club.slug == "cluba").one()
    assert r.json()["club_id"] == club_a.id


def test_athlete_list_is_isolated(client, db_session):
    token_a = _login(client, "admin@a.local")
    r = client.get("/api/v1/athletes", headers=_hdr(token_a))
    assert r.status_code == 200
    names = {a["full_name"] for a in r.json()}
    assert "Joueur CLA" in names
    assert "Joueur CLB" not in names


def test_cross_club_athlete_detail_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_athlete_id = _ids(db_session, Athlete, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.get(f"/api/v1/athletes/{b_athlete_id}", headers=_hdr(token_a))
    assert r.status_code == 404


def test_cross_club_athlete_patch_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_athlete_id = _ids(db_session, Athlete, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.patch(
        f"/api/v1/athletes/{b_athlete_id}",
        headers=_hdr(token_a),
        json={"full_name": "Hacked"},
    )
    assert r.status_code == 404


def test_cross_club_athlete_delete_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_athlete_id = _ids(db_session, Athlete, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.delete(f"/api/v1/athletes/{b_athlete_id}", headers=_hdr(token_a))
    assert r.status_code == 404
    # L'athlète du club B existe toujours
    assert db_session.get(Athlete, b_athlete_id) is not None


def test_cross_club_event_detail_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_event_id = _ids(db_session, Event, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.get(f"/api/v1/events/{b_event_id}", headers=_hdr(token_a))
    assert r.status_code == 404


def test_event_list_is_isolated(client, db_session):
    token_a = _login(client, "admin@a.local")
    r = client.get("/api/v1/events", headers=_hdr(token_a))
    assert r.status_code == 200
    titles = {e["title"] for e in r.json()}
    assert "Séance CLA" in titles
    assert "Séance CLB" not in titles


def test_cross_club_ledger_patch_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_ledger_id = _ids(db_session, LedgerEntry, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.patch(
        f"/api/v1/ledger/{b_ledger_id}",
        headers=_hdr(token_a),
        json={"amount": 999999},
    )
    assert r.status_code == 404


def test_cross_club_inventory_patch_404(client, db_session):
    club_b = db_session.query(Club).filter(Club.slug == "clubb").one()
    b_item_id = _ids(db_session, InventoryItem, club_b.id)[0]
    token_a = _login(client, "admin@a.local")
    r = client.patch(
        f"/api/v1/inventory/items/{b_item_id}",
        headers=_hdr(token_a),
        json={"quantity": 0},
    )
    assert r.status_code == 404


def test_ledger_list_is_isolated(client, db_session):
    token_b = _login(client, "admin@b.local")
    r = client.get("/api/v1/ledger", headers=_hdr(token_b))
    assert r.status_code == 200
    labels = {e["label"] for e in r.json()}
    assert "Recette CLB" in labels
    assert "Recette CLA" not in labels
