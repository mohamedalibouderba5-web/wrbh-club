"""Numéros techniques et références immuables.

Le numéro de ligne visible d'une inscription est calculé dynamiquement par
l'API. ``seq_no`` et ``reference`` sont des identités historiques croissantes :
elles ne sont jamais libérées, réattribuées ou modifiées.
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Category, FeeInstallment, LedgerEntry, Payment, Registration, Season


def season_short_code(season_name: str | None) -> str:
    """2026/2027 → 26-27."""
    if not season_name:
        return "NA"
    years = re.findall(r"20(\d{2})", season_name)
    if len(years) >= 2:
        return f"{years[0]}-{years[1]}"
    if len(years) == 1:
        y = int(years[0])
        return f"{y:02d}-{(y + 1) % 100:02d}"
    cleaned = season_name.strip().replace("/", "-").replace(" ", "")
    return cleaned[:8] or "NA"


def next_seq(db: Session, model, *, club_id: int | None, season_id: int | None = None) -> int:
    """Compteur max+1 (paiements, caisse, échéances)."""
    q = db.query(func.coalesce(func.max(model.seq_no), 0))
    if club_id is not None and hasattr(model, "club_id"):
        q = q.filter((model.club_id == club_id) | (model.club_id.is_(None)))
    if season_id is not None and hasattr(model, "season_id"):
        q = q.filter(model.season_id == season_id)
    return int(q.scalar() or 0) + 1


def next_registration_seq(db: Session, *, club_id: int | None, season_id: int | None) -> int:
    """Prochain compteur historique, archives incluses (jamais réutilisé)."""
    q = db.query(func.coalesce(func.max(Registration.seq_no), 0))
    if club_id is not None:
        q = q.filter((Registration.club_id == club_id) | (Registration.club_id.is_(None)))
    if season_id is not None:
        q = q.filter(Registration.season_id == season_id)
    return int(q.scalar() or 0) + 1


def release_registration_identity(reg: Registration) -> None:
    """Archive : conserve l'identité historique, libère uniquement le kit."""
    reg.kit_number = None


def build_registration_reference(season_short: str, category_code: str | None, seq_no: int) -> str:
    cat = (category_code or "NA").upper().replace(" ", "")
    return f"{season_short}/{cat}/{seq_no:04d}"


def assign_registration_identity(
    db: Session,
    reg: Registration,
    *,
    club_id: int | None,
    season: Season | None,
    category: Category | None,
) -> None:
    """Attribue une identité historique croissante et immuable."""
    if getattr(reg, "seq_no", None) and getattr(reg, "reference", None):
        return
    season_id = reg.season_id
    if not getattr(reg, "seq_no", None):
        reg.seq_no = next_registration_seq(db, club_id=club_id, season_id=season_id)
    if not getattr(reg, "reference", None):
        short = season_short_code(season.name if season else None)
        cat_code = category.code if category else None
        # L'id DB n'est jamais réutilisé : il rend la référence indépendante
        # du rang visible et robuste même après archive/suppression.
        if reg.id:
            cat = (cat_code or "NA").upper().replace(" ", "")
            reg.reference = f"{short}/{cat}/R{int(reg.id):08d}"
        else:
            reg.reference = build_registration_reference(short, cat_code, int(reg.seq_no))


def build_op_reference(prefix: str, year: int, seq_no: int) -> str:
    return f"{prefix}/{year}/{seq_no:05d}"


def assign_payment_identity(db: Session, payment: Payment, *, club_id: int | None) -> None:
    if getattr(payment, "seq_no", None) and payment.reference:
        return
    year = payment.paid_on.year if payment.paid_on else 2026
    if not getattr(payment, "seq_no", None):
        # Compteur club (toutes saisons) pour les paiements
        q = db.query(func.coalesce(func.max(Payment.seq_no), 0))
        if club_id is not None:
            q = q.filter((Payment.club_id == club_id) | (Payment.club_id.is_(None)))
        payment.seq_no = int(q.scalar() or 0) + 1
    if not payment.reference:
        payment.reference = build_op_reference("PAY", year, int(payment.seq_no))


def assign_ledger_identity(db: Session, entry: LedgerEntry, *, club_id: int | None) -> None:
    if getattr(entry, "seq_no", None) and getattr(entry, "reference", None):
        return
    year = entry.entry_date.year if entry.entry_date else 2026
    if not getattr(entry, "seq_no", None):
        q = db.query(func.coalesce(func.max(LedgerEntry.seq_no), 0))
        if club_id is not None:
            q = q.filter((LedgerEntry.club_id == club_id) | (LedgerEntry.club_id.is_(None)))
        entry.seq_no = int(q.scalar() or 0) + 1
    if not getattr(entry, "reference", None):
        prefix = "REC" if entry.entry_type == "income" else "DEP"
        if entry.category == "equipment":
            prefix = "ACH"
        entry.reference = build_op_reference(prefix, year, int(entry.seq_no))


def assign_installment_identity(db: Session, inst: FeeInstallment, *, club_id: int | None) -> None:
    if getattr(inst, "seq_no", None) and getattr(inst, "reference", None):
        return
    year = inst.due_date.year if inst.due_date else 2026
    if not getattr(inst, "seq_no", None):
        q = db.query(func.coalesce(func.max(FeeInstallment.seq_no), 0))
        if club_id is not None:
            q = q.filter((FeeInstallment.club_id == club_id) | (FeeInstallment.club_id.is_(None)))
        inst.seq_no = int(q.scalar() or 0) + 1
    if not getattr(inst, "reference", None):
        inst.reference = build_op_reference("ECH", year, int(inst.seq_no))


def backfill_registration_identities(db: Session) -> int:
    """Remplit seq_no/reference pour les inscriptions existantes (ordre id)."""
    updated = 0
    seasons = {s.id: s for s in db.query(Season).all()}
    cats = {c.id: c for c in db.query(Category).all()}
    regs = (
        db.query(Registration)
        .filter((Registration.seq_no.is_(None)) | (Registration.reference.is_(None)))
        .order_by(Registration.season_id, Registration.id)
        .all()
    )
    counters: dict[tuple[Optional[int], int], int] = {}
    for reg in regs:
        key = (reg.club_id, reg.season_id)
        if key not in counters:
            mx = (
                db.query(func.coalesce(func.max(Registration.seq_no), 0))
                .filter(Registration.season_id == reg.season_id)
                .scalar()
            )
            counters[key] = int(mx or 0)
        if not reg.seq_no:
            counters[key] += 1
            reg.seq_no = counters[key]
        if not reg.reference:
            season = seasons.get(reg.season_id)
            cat = cats.get(reg.category_id) if reg.category_id else None
            reg.reference = build_registration_reference(
                season_short_code(season.name if season else None),
                cat.code if cat else None,
                int(reg.seq_no),
            )
            updated += 1
    if updated:
        db.commit()
    return updated


def backfill_operation_identities(db: Session) -> int:
    """Remplit N°/réf pour paiements, caisse et échéances manquants."""
    updated = 0
    for pay in (
        db.query(Payment)
        .filter((Payment.seq_no.is_(None)) | (Payment.reference.is_(None)))
        .order_by(Payment.id)
        .all()
    ):
        assign_payment_identity(db, pay, club_id=pay.club_id)
        updated += 1
    for entry in (
        db.query(LedgerEntry)
        .filter((LedgerEntry.seq_no.is_(None)) | (LedgerEntry.reference.is_(None)))
        .order_by(LedgerEntry.id)
        .all()
    ):
        assign_ledger_identity(db, entry, club_id=entry.club_id)
        updated += 1
    for inst in (
        db.query(FeeInstallment)
        .filter((FeeInstallment.seq_no.is_(None)) | (FeeInstallment.reference.is_(None)))
        .order_by(FeeInstallment.id)
        .all()
    ):
        assign_installment_identity(db, inst, club_id=inst.club_id)
        updated += 1
    if updated:
        db.commit()
    return updated
