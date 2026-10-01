"""A6 — parcours paiement minimal : échéance → encaissement."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Athlete, Category, Club, Discipline, FeeInstallment, Payment, Registration, Season, User


@pytest.fixture()
def ctx():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    club = Club(name="Club Pay", acronym="CPY", slug="clubpay", status="active", plan="club")
    session.add(club)
    session.flush()
    admin = User(
        club_id=club.id,
        email="pay@t.local",
        full_name="Admin Pay",
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
    disc = Discipline(club_id=club.id, name="Football", code="FOOT")
    session.add_all([admin, season, disc])
    session.flush()
    cat = Category(
        club_id=club.id,
        season_id=season.id,
        discipline_id=disc.id,
        code="FOOT-U15",
        name="U15",
        birth_year_min=2011,
        birth_year_max=2013,
    )
    athlete = Athlete(club_id=club.id, full_name="Payeur Test", birth_date=date(2012, 1, 1))
    session.add_all([cat, athlete])
    session.flush()
    reg = Registration(
        club_id=club.id,
        athlete_id=athlete.id,
        season_id=season.id,
        category_id=cat.id,
        status="approved",
        registered_on=date.today(),
    )
    session.add(reg)
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    tok = client.post(
        "/api/v1/auth/login",
        data={"username": "pay@t.local", "password": "AdminPass123!", "club_slug": "clubpay"},
    ).json()["access_token"]
    yield client, session, tok, athlete, season
    app.dependency_overrides.clear()


def test_quick_payment_creates_payment_and_receipt_path(ctx):
    client, session, tok, athlete, _ = ctx
    res = client.post(
        "/api/v1/payments/quick",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "payment_type": "monthly",
            "athlete_id": athlete.id,
            "amount": 800,
            "paid_on": date.today().isoformat(),
            "method": "cash",
            "month": date.today().month,
            "year": date.today().year,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(str(body["amount"])) == Decimal("800")
    assert session.query(Payment).filter(Payment.athlete_id == athlete.id).count() == 1
    assert session.query(FeeInstallment).filter(FeeInstallment.athlete_id == athlete.id).count() >= 1
