"""Parcours inscription (non couvert jusqu'ici) — regression P0 du 2026-10-01.

Le commit deploye en production appelait ``ensure_parent_account(..., club_id=...)``
alors que la signature ne declarait pas ``club_id`` : toute creation d'inscription
avec un telephone parent renvoyait HTTP 500.

Ce test verrouille aussi le cloisonnement du compte parent cree (``club_id``
doit etre celui du club, jamais ``NULL``), sans quoi le parent devient visible
par tous les clubs de la plateforme.
"""
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
from app.models import Athlete, Category, Club, Discipline, Season, User


@pytest.fixture()
def ctx():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()

    club = Club(name="Club T", acronym="CLT", slug="clubt", status="active")
    other = Club(name="Club U", acronym="CLU", slug="clubu", status="active")
    session.add_all([club, other])
    session.flush()

    admin = User(
        club_id=club.id,
        email="admin@t.local",
        full_name="Admin T",
        role="admin",
        password_hash=hash_password("AdminPass123!"),
        must_change_password=False,
    )
    session.add(admin)

    season = Season(
        club_id=club.id,
        name="2026/2027",
        starts_on=date(2026, 8, 1),
        ends_on=date(2027, 7, 31),
        is_current=True,
        registration_open=True,
    )
    disc = Discipline(club_id=club.id, name="Football", code="FOOT")
    session.add_all([season, disc])
    session.flush()

    cat = Category(
        club_id=club.id,
        season_id=season.id,
        discipline_id=disc.id,
        code="FOOT-U15",
        name="Football U15",
        birth_year_min=2011,
        birth_year_max=2013,
    )
    athlete = Athlete(club_id=club.id, full_name="Joueur Test", birth_date=date(2012, 4, 4))
    session.add_all([cat, athlete])
    session.commit()

    def _override():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    tok = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@t.local", "password": "AdminPass123!", "club_slug": "clubt"},
    ).json()["access_token"]
    yield client, session, tok, club, season, cat, athlete
    app.dependency_overrides.clear()


def test_registration_with_parent_phone_succeeds(ctx):
    """Regression : ce POST renvoyait HTTP 500 en production."""
    client, _, tok, _, season, cat, athlete = ctx
    res = client.post(
        "/api/v1/registrations",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "athlete_id": athlete.id,
            "season_id": season.id,
            "category_id": cat.id,
            "parent_phone": "0551234567",
            "parent_name": "Parent Test",
        },
    )
    assert res.status_code == 200, res.text


def test_parent_account_is_scoped_to_club(ctx):
    """Le compte parent cree ne doit pas avoir club_id NULL (sinon visible par tous)."""
    client, session, tok, club, season, cat, athlete = ctx
    client.post(
        "/api/v1/registrations",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "athlete_id": athlete.id,
            "season_id": season.id,
            "category_id": cat.id,
            "parent_phone": "0551234567",
            "parent_name": "Parent Test",
        },
    )
    parent = session.query(User).filter(User.role == "parent").one()
    assert parent.club_id == club.id, (
        f"compte parent cree avec club_id={parent.club_id} "
        "-> visible par tous les clubs via or_(club_id == X, club_id IS NULL)"
    )


def test_athlete_creation_scopes_parent_account(ctx):
    """Meme exigence via POST /athletes (club_id obligatoire sur le parent)."""
    client, session, tok, club, _, _, _ = ctx
    res = client.post(
        "/api/v1/athletes",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "full_name": "Autre Joueur",
            "birth_date": "2012-09-09",
            "parent_phone": "0557654321",
            "parent_name": "Parent Deux",
        },
    )
    assert res.status_code == 200, res.text
    parent = session.query(User).filter(User.phone == "0557654321").one()
    assert parent.club_id == club.id, (
        f"compte parent cree avec club_id={parent.club_id} via POST /athletes"
    )


def test_suspended_club_blocks_write_allows_read(ctx):
    """A7 : jeton deja emis + club suspendu → POST 403, GET 200."""
    client, session, tok, club, _, _, _ = ctx
    club.status = "suspended"
    session.commit()
    headers = {"Authorization": f"Bearer {tok}"}
    get_res = client.get("/api/v1/athletes", headers=headers)
    assert get_res.status_code == 200, get_res.text
    post_res = client.post(
        "/api/v1/athletes",
        headers=headers,
        json={"full_name": "Bloque", "birth_date": "2012-01-01"},
    )
    assert post_res.status_code == 403, post_res.text
    assert "suspendu" in post_res.text.lower()
