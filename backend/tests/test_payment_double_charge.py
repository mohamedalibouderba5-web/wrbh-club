"""FI-03/04 / B09 — payments/quick impute l'échéance due, pas de fantôme ni surpaiement."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Athlete, Category, Club, Discipline, FeeInstallment, Payment, Registration, Season, User


def _pay_ctx():
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
        email="pay2@t.local",
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
    athlete = Athlete(club_id=club.id, full_name="Payeur Due", birth_date=date(2012, 1, 1))
    session.add_all([cat, athlete])
    session.flush()
    reg = Registration(
        club_id=club.id,
        athlete_id=athlete.id,
        season_id=season.id,
        category_id=cat.id,
        status="approved",
        registered_on=date.today(),
        subscription_fee=Decimal("2000"),
    )
    session.add(reg)
    session.flush()
    due = FeeInstallment(
        club_id=club.id,
        athlete_id=athlete.id,
        season_id=season.id,
        registration_id=reg.id,
        label="ECH/INSCRIPTION",
        label_ar="مستحق",
        due_date=date.today(),
        amount=Decimal("2000"),
        amount_paid=Decimal("0"),
        status="due",
    )
    session.add(due)
    session.commit()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    tok = client.post(
        "/api/v1/auth/login",
        data={"username": "pay2@t.local", "password": "AdminPass123!", "club_slug": "clubpay"},
    ).json()["access_token"]
    return client, session, tok, athlete, due


def test_quick_payment_imputes_existing_installment():
    client, session, tok, athlete, due = _pay_ctx()
    try:
        before = session.query(FeeInstallment).filter(FeeInstallment.athlete_id == athlete.id).count()
        res = client.post(
            "/api/v1/payments/quick",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "payment_type": "inscription",
                "athlete_id": athlete.id,
                "amount": 500,
                "paid_on": date.today().isoformat(),
                "method": "cash",
            },
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["installment_id"] == due.id
        session.refresh(due)
        assert due.amount_paid == Decimal("500")
        assert due.status == "partial"
        after = session.query(FeeInstallment).filter(FeeInstallment.athlete_id == athlete.id).count()
        assert after == before  # pas d'échéance fantôme
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_double_quick_payment_no_overpay():
    client, session, tok, athlete, due = _pay_ctx()
    try:
        headers = {"Authorization": f"Bearer {tok}"}
        payload = {
            "payment_type": "inscription",
            "athlete_id": athlete.id,
            "amount": 1500,
            "paid_on": date.today().isoformat(),
            "method": "cash",
            "installment_id": due.id,
        }
        r1 = client.post("/api/v1/payments/quick", headers=headers, json=payload)
        assert r1.status_code == 200, r1.text
        session.refresh(due)
        assert due.amount_paid == Decimal("1500")

        r2 = client.post(
            "/api/v1/payments/quick",
            headers=headers,
            json={**payload, "amount": 1500},
        )
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert Decimal(str(body2["amount"])) == Decimal("500")  # clamp au reste
        assert body2["installment_id"] == due.id
        session.refresh(due)
        assert due.amount_paid == Decimal("2000")
        assert due.status == "paid"

        r3 = client.post(
            "/api/v1/payments/quick",
            headers=headers,
            json={**payload, "amount": 100},
        )
        assert r3.status_code == 409, r3.text
        assert session.query(Payment).filter(Payment.athlete_id == athlete.id).count() == 2
        assert (
            session.query(FeeInstallment).filter(FeeInstallment.athlete_id == athlete.id).count()
            == 1
        )
    finally:
        app.dependency_overrides.clear()
        session.close()
