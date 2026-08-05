"""Cotisations : constantes club, échéances mensuelles / assurance."""
from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Club, ClubSetting, FeeInstallment, Registration
from app.services.references import assign_installment_identity

# Constantes par défaut WRBH (modifiables via /finance/settings)
DEFAULT_SETTINGS: dict[str, tuple[str, str, str]] = {
    # key: (value, label_fr, label_ar)
    "monthly_subscription_dzd": ("800", "Abonnement mensuel (DZD)", "الاشتراك الشهري"),
    "annual_insurance_dzd": ("1500", "Assurance annuelle (DZD)", "التأمين السنوي"),
    "inscription_fee_dzd": ("4000", "Droits d'inscription (DZD)", "حقوق الاشتراك"),
}

MONTH_LABELS_FR = {
    1: "janvier",
    2: "février",
    3: "mars",
    4: "avril",
    5: "mai",
    6: "juin",
    7: "juillet",
    8: "août",
    9: "septembre",
    10: "octobre",
    11: "novembre",
    12: "décembre",
}

MONTH_LABELS_AR = {
    1: "جانفي",
    2: "فيفري",
    3: "مارس",
    4: "أفريل",
    5: "ماي",
    6: "جوان",
    7: "جويلية",
    8: "أوت",
    9: "سبتمبر",
    10: "أكتوبر",
    11: "نوفمبر",
    12: "ديسمبر",
}


def _resolve_club_id(db: Session, club_id: int | None = None) -> int | None:
    if club_id is not None:
        return club_id
    club = db.query(Club).first()
    return club.id if club else None


def ensure_default_settings(db: Session, club_id: int | None = None) -> dict[str, str]:
    cid = _resolve_club_id(db, club_id)
    if not cid:
        return {k: v[0] for k, v in DEFAULT_SETTINGS.items()}
    existing = {
        s.key: s.value
        for s in db.query(ClubSetting).filter(ClubSetting.club_id == cid).all()
    }
    dirty = False
    for key, (val, label, label_ar) in DEFAULT_SETTINGS.items():
        if key not in existing:
            db.add(
                ClubSetting(
                    club_id=cid,
                    key=key,
                    value=val,
                    label=label,
                    label_ar=label_ar,
                )
            )
            existing[key] = val
            dirty = True
    if dirty:
        db.commit()
    return existing


def get_fee_settings(db: Session, club_id: int | None = None) -> dict[str, Decimal]:
    raw = ensure_default_settings(db, club_id=club_id)
    out: dict[str, Decimal] = {}
    for key in DEFAULT_SETTINGS:
        try:
            out[key] = Decimal(str(raw.get(key, DEFAULT_SETTINGS[key][0])))
        except Exception:
            out[key] = Decimal(DEFAULT_SETTINGS[key][0])
    return out


def apply_settings_to_open_installments(
    db: Session,
    *,
    club_id: int,
    fees: dict[str, Decimal],
) -> dict[str, int]:
    """Met à jour les échéances non soldées pour coller aux nouvelles constantes."""
    updated = {"assurance": 0, "mensuel": 0}
    open_status = ("due", "partial", "overdue")

    rows_ass = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.label == "assurance",
            FeeInstallment.status.in_(open_status),
            FeeInstallment.club_id == club_id,
        )
        .all()
    )
    # Tolère club_id NULL legacy
    rows_ass_null = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.label == "assurance",
            FeeInstallment.status.in_(open_status),
            FeeInstallment.club_id.is_(None),
        )
        .all()
    )
    for row in list(rows_ass) + list(rows_ass_null):
        new_amt = fees["annual_insurance_dzd"]
        if row.amount != new_amt:
            paid = Decimal(str(row.amount_paid or 0))
            row.amount = new_amt
            if paid >= new_amt and new_amt > 0:
                row.status = "paid"
                row.amount_paid = new_amt
            elif paid > 0:
                row.status = "partial"
            else:
                row.status = "due"
            updated["assurance"] += 1

    monthly = fees["monthly_subscription_dzd"]
    rows_m = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.label.like("mensuel-%"),
            FeeInstallment.status.in_(open_status),
        )
        .filter(
            (FeeInstallment.club_id == club_id) | (FeeInstallment.club_id.is_(None))
        )
        .all()
    )
    for row in rows_m:
        if row.amount != monthly:
            paid = Decimal(str(row.amount_paid or 0))
            row.amount = monthly
            if paid >= monthly and monthly > 0:
                row.status = "paid"
                row.amount_paid = monthly
            elif paid > 0:
                row.status = "partial"
            else:
                row.status = "due"
            updated["mensuel"] += 1
    return updated


def monthly_label(year: int, month: int) -> str:
    return f"mensuel-{year}-{month:02d}"


def monthly_label_display(year: int, month: int) -> tuple[str, str]:
    fr = MONTH_LABELS_FR.get(month, str(month))
    ar = MONTH_LABELS_AR.get(month, str(month))
    return f"{fr} {year}", f"{ar} {year}"


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
        club_id=getattr(reg, "club_id", None),
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
    db.flush()
    assign_installment_identity(db, row, club_id=getattr(reg, "club_id", None))
    return row


def ensure_insurance_installment(
    db: Session, reg: Registration, amount: Decimal | None = None
) -> FeeInstallment | None:
    """Crée l'échéance assurance annuelle pour la saison."""
    fees = get_fee_settings(db, club_id=getattr(reg, "club_id", None))
    amt = amount if amount is not None else fees["annual_insurance_dzd"]
    if amt <= 0:
        return None
    existing = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.athlete_id == reg.athlete_id,
            FeeInstallment.season_id == reg.season_id,
            FeeInstallment.label == "assurance",
        )
        .first()
    )
    if existing:
        # Si non payée, aligner sur la constante actuelle
        paid = Decimal(str(existing.amount_paid or 0))
        if paid <= 0 and existing.amount != amt:
            existing.amount = amt
            existing.status = "due"
        return existing
    row = FeeInstallment(
        club_id=getattr(reg, "club_id", None),
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        registration_id=reg.id,
        label="assurance",
        label_ar="التأمين السنوي",
        due_date=reg.registered_on or date.today(),
        amount=amt,
        amount_paid=Decimal("0"),
        status="due",
    )
    db.add(row)
    db.flush()
    assign_installment_identity(db, row, club_id=getattr(reg, "club_id", None))
    return row


def ensure_monthly_installment(
    db: Session,
    *,
    athlete_id: int,
    season_id: int,
    year: int,
    month: int,
    amount: Decimal | None = None,
    registration_id: int | None = None,
    club_id: int | None = None,
) -> FeeInstallment:
    """Crée ou retourne l'échéance mensuelle pour un joueur."""
    fees = get_fee_settings(db, club_id=club_id)
    amt = amount if amount is not None else fees["monthly_subscription_dzd"]
    label = monthly_label(year, month)
    existing = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.athlete_id == athlete_id,
            FeeInstallment.season_id == season_id,
            FeeInstallment.label == label,
        )
        .first()
    )
    if existing:
        paid = Decimal(str(existing.amount_paid or 0))
        if paid <= 0 and existing.amount != amt:
            existing.amount = amt
        return existing
    display_fr, display_ar = monthly_label_display(year, month)
    due = date(year, month, min(5, monthrange(year, month)[1]))
    row = FeeInstallment(
        club_id=club_id,
        athlete_id=athlete_id,
        season_id=season_id,
        registration_id=registration_id,
        label=label,
        label_ar=f"اشتراك {display_ar}",
        due_date=due,
        amount=amt,
        amount_paid=Decimal("0"),
        status="due",
    )
    db.add(row)
    db.flush()
    assign_installment_identity(db, row, club_id=club_id or getattr(row, "club_id", None))
    return row


def ensure_season_fee_bundle(db: Session, reg: Registration) -> None:
    """À l'approbation : inscription (si fee) + assurance annuelle."""
    ensure_subscription_installment(db, reg)
    ensure_insurance_installment(db, reg)
