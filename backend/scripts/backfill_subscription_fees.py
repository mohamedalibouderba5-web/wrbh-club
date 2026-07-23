#!/usr/bin/env python3
"""Crée les échéances manquantes pour inscriptions approved avec subscription_fee."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal  # noqa: E402
from app.models import FeeInstallment, Registration  # noqa: E402
from app.services.fees import ensure_subscription_installment  # noqa: E402


def main() -> int:
    db = SessionLocal()
    created = 0
    try:
        regs = (
            db.query(Registration)
            .filter(Registration.status == "approved", Registration.subscription_fee.isnot(None))
            .all()
        )
        for reg in regs:
            before = (
                db.query(FeeInstallment)
                .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
                .count()
            )
            ensure_subscription_installment(db, reg)
            db.flush()
            after = (
                db.query(FeeInstallment)
                .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
                .count()
            )
            if after > before:
                created += 1
        db.commit()
        print(f"registrations={len(regs)} installments_created={created}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
