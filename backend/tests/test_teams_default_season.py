"""ST-06 / A05 — GET /teams sans season_id = saison courante du club."""
from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Category, Club, Discipline, Season, Team, User


def _ctx():
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

    for club, email in ((club_a, "a@t.local"), (club_b, "b@t.local")):
        session.add(
            User(
                club_id=club.id,
                email=email,
                full_name=f"Admin {club.slug}",
                role="admin",
                password_hash=hash_password("AdminPass123!"),
                must_change_password=False,
            )
        )
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
            code="U15",
            name="U15",
            birth_year_min=2011,
            birth_year_max=2013,
        )
        session.add(cat)
        session.flush()
        session.add(
            Team(
                club_id=club.id,
                category_id=cat.id,
                name=f"Équipe {club.acronym}",
                code=f"{club.acronym}-U15",
            )
        )

    # Saison non courante club A (ne doit pas apparaître dans GET /teams défaut)
    old = Season(
        club_id=club_a.id,
        name="2024/2025",
        starts_on=date(2024, 8, 1),
        ends_on=date(2025, 7, 31),
        is_current=False,
    )
    session.add(old)
    session.flush()
    disc_a = session.query(Discipline).filter(Discipline.club_id == club_a.id).first()
    old_cat = Category(
        club_id=club_a.id,
        season_id=old.id,
        discipline_id=disc_a.id,
        code="OLD",
        name="Old",
        birth_year_min=2000,
        birth_year_max=2002,
    )
    session.add(old_cat)
    session.flush()
    session.add(
        Team(club_id=club_a.id, category_id=old_cat.id, name="Équipe OLD", code="OLD-1")
    )
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    return client, session, club_a, club_b


def test_teams_default_uses_club_current_season():
    client, session, club_a, club_b = _ctx()
    try:
        tok_a = client.post(
            "/api/v1/auth/login",
            data={"username": "a@t.local", "password": "AdminPass123!", "club_slug": "cluba"},
        ).json()["access_token"]
        tok_b = client.post(
            "/api/v1/auth/login",
            data={"username": "b@t.local", "password": "AdminPass123!", "club_slug": "clubb"},
        ).json()["access_token"]

        res_a = client.get("/api/v1/teams", headers={"Authorization": f"Bearer {tok_a}"})
        assert res_a.status_code == 200, res_a.text
        names_a = {t["name"] for t in res_a.json()}
        assert "Équipe CLA" in names_a
        assert "Équipe OLD" not in names_a
        assert "Équipe CLB" not in names_a

        res_b = client.get("/api/v1/teams", headers={"Authorization": f"Bearer {tok_b}"})
        assert res_b.status_code == 200, res_b.text
        names_b = {t["name"] for t in res_b.json()}
        assert names_b == {"Équipe CLB"}

        coaches = client.get(
            "/api/v1/teams/coaches", headers={"Authorization": f"Bearer {tok_a}"}
        )
        assert coaches.status_code == 200, coaches.text
        assert any(t["name"] == "Équipe CLA" for t in coaches.json())
        assert not any(t["name"] == "Équipe OLD" for t in coaches.json())
    finally:
        app.dependency_overrides.clear()
        session.close()
