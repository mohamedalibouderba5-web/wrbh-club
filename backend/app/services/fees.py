"""Génération cotisations / échéances à partir d'une inscription."""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import FeeInstallment, Registration


def ensure_subscription_installment(db: Session, reg: Registration) -> FeeInstallment | None:
    """Crée une échéance 'inscription' si subscription_fee > 0 et absente."""
    if reg.subscription_fee is None:
        return None
    amount = Decimal(str(reg.subscription_fee))
    if amount <= 0:
        return None
    existing = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.registration_id == reg.id,
            FeeInstallment.label == "inscription",
        )
        .first()
    )
    if existing:
        return existing
    row = FeeInstallment(
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        registration_id=reg.id,
        label="inscription",
        label_ar="حقوق الاشتراك",
        due_date=reg.registered_on,
        amount=amount,
        amount_paid=Decimal("0"),
        status="due",
    )
    db.add(row)
    return row
