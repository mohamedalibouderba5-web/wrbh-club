from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.core.tenant import assert_same_club, get_current_club_id
from sqlalchemy import or_
from app.models import (
    Athlete,
    Club,
    ClubSetting,
    CoachPayroll,
    FeeInstallment,
    InventoryAssignment,
    InventoryItem,
    LedgerEntry,
    ParentChild,
    Payment,
    Receipt,
    Registration,
    Season,
    User,
)
from app.schemas import (
    ClubFeeSettingsOut,
    ClubFeeSettingsUpdate,
    EquipmentPurchaseCreate,
    InstallmentOut,
    InstallmentUpdate,
    InventoryAssignmentUpdate,
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemUpdate,
    LedgerCreate,
    LedgerOut,
    LedgerUpdate,
    PaymentCreate,
    PaymentUpdate,
    QuickPaymentCreate,
)
from app.services.audit import write_audit
from app.services.fast_cache import cache_delete_prefix, cache_get, cache_set
from app.services.fees import (
    DEFAULT_SETTINGS,
    apply_settings_to_open_installments,
    ensure_default_settings,
    ensure_insurance_installment,
    ensure_monthly_installment,
    ensure_subscription_installment,
    get_fee_settings,
    monthly_label_display,
)
from app.services.references import (
    assign_installment_identity,
    assign_ledger_identity,
    assign_payment_identity,
    build_op_reference,
)

router = APIRouter(tags=["finance"])


def _athlete_names(db: Session, ids: list[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = db.query(Athlete.id, Athlete.full_name).filter(Athlete.id.in_(ids)).all()
    return {r.id: r.full_name for r in rows}


def _installment_out(row: FeeInstallment, names: dict[int, str]) -> InstallmentOut:
    return InstallmentOut(
        id=row.id,
        athlete_id=row.athlete_id,
        athlete_name=names.get(row.athlete_id),
        season_id=row.season_id,
        label=row.label,
        label_ar=row.label_ar,
        due_date=row.due_date,
        amount=row.amount,
        amount_paid=row.amount_paid,
        status=row.status,
        seq_no=getattr(row, "seq_no", None),
        reference=getattr(row, "reference", None),
    )


def _current_season_id(db: Session) -> int | None:
    s = db.query(Season).filter(Season.is_current.is_(True)).first()
    return s.id if s else None


def _apply_payment_to_installment(inst: FeeInstallment, amount: Decimal) -> None:
    inst.amount_paid = (inst.amount_paid or Decimal("0")) + amount
    if inst.amount_paid >= inst.amount:
        inst.status = "paid"
        inst.amount_paid = inst.amount
    elif inst.amount_paid > 0:
        inst.status = "partial"


def _make_receipt(db: Session, payment_id: int, club_id: int | None = None) -> Receipt:
    count = (
        db.query(func.count(Receipt.id)).filter(Receipt.club_id == club_id).scalar()
        if club_id
        else db.query(func.count(Receipt.id)).scalar()
    ) or 0
    prefix = f"C{club_id}" if club_id else "WRBH"
    receipt = Receipt(
        club_id=club_id,
        payment_id=payment_id,
        number=f"{prefix}-{date.today().year}-{count + 1:05d}",
    )
    db.add(receipt)
    return receipt


def _ledger_income_for_payment(
    db: Session,
    *,
    club_id: int,
    season_id: int | None,
    label: str,
    amount: Decimal,
    paid_on: date,
    user_id: int,
    category: str = "subscription",
) -> None:
    entry = LedgerEntry(
        club_id=club_id,
        season_id=season_id,
        entry_type="income",
        category=category,
        label=label,
        amount=amount,
        entry_date=paid_on,
        created_by=user_id,
    )
    assign_ledger_identity(db, entry, club_id=club_id)
    db.add(entry)


@router.get("/finance/settings", response_model=ClubFeeSettingsOut)
def get_finance_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
    club_id: int = Depends(get_current_club_id),
):
    fees = get_fee_settings(db, club_id=club_id)
    return ClubFeeSettingsOut(
        monthly_subscription_dzd=fees["monthly_subscription_dzd"],
        annual_insurance_dzd=fees["annual_insurance_dzd"],
        inscription_fee_dzd=fees["inscription_fee_dzd"],
    )


@router.put("/finance/settings", response_model=ClubFeeSettingsOut)
def update_finance_settings(
    payload: ClubFeeSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    ensure_default_settings(db, club_id=club_id)
    mapping = {
        "monthly_subscription_dzd": payload.monthly_subscription_dzd,
        "annual_insurance_dzd": payload.annual_insurance_dzd,
        "inscription_fee_dzd": payload.inscription_fee_dzd,
    }
    for key, val in mapping.items():
        if val is None:
            continue
        if val < 0:
            raise HTTPException(400, f"Montant invalide pour {key}")
        row = (
            db.query(ClubSetting)
            .filter(ClubSetting.club_id == club_id, ClubSetting.key == key)
            .first()
        )
        if row:
            row.value = str(val)
        else:
            meta = DEFAULT_SETTINGS[key]
            db.add(
                ClubSetting(
                    club_id=club_id,
                    key=key,
                    value=str(val),
                    label=meta[1],
                    label_ar=meta[2],
                )
            )
    fees = get_fee_settings(db, club_id=club_id)
    # Relecture forcée après écriture (évite cache mémoire stale)
    for key, val in mapping.items():
        if val is not None:
            fees[key] = val
    synced = apply_settings_to_open_installments(db, club_id=club_id, fees=fees)
    write_audit(
        db,
        action="update",
        entity="fee_settings",
        entity_id=club_id,
        user_id=user.id,
        club_id=club_id,
        detail=f"insurance={fees['annual_insurance_dzd']} monthly={fees['monthly_subscription_dzd']} synced={synced}",
    )
    db.commit()
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return ClubFeeSettingsOut(
        monthly_subscription_dzd=fees["monthly_subscription_dzd"],
        annual_insurance_dzd=fees["annual_insurance_dzd"],
        inscription_fee_dzd=fees["inscription_fee_dzd"],
    )


@router.get("/installments", response_model=list[InstallmentOut])
def list_installments(
    athlete_id: int | None = None,
    season_id: int | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(FeeInstallment).filter(
        or_(FeeInstallment.club_id == club_id, FeeInstallment.club_id.is_(None))
    )
    if athlete_id:
        q = q.filter(FeeInstallment.athlete_id == athlete_id)
    if season_id:
        q = q.filter(FeeInstallment.season_id == season_id)
    if status:
        q = q.filter(FeeInstallment.status == status)
    if user.role == Role.PARENT:
        ids = {r[0] for r in db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id)}
        q = q.filter(FeeInstallment.athlete_id.in_(ids or {-1}))
    rows = q.order_by(FeeInstallment.due_date.desc().nullslast(), FeeInstallment.id.desc()).offset(skip).limit(limit).all()
    names = _athlete_names(db, [r.athlete_id for r in rows])
    return [_installment_out(r, names) for r in rows]


@router.patch("/installments/{installment_id}", response_model=InstallmentOut)
def update_installment(
    installment_id: int,
    payload: InstallmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    inst = db.get(FeeInstallment, installment_id)
    if not inst:
        raise HTTPException(404, "Échéance introuvable")
    assert_same_club(inst, club_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in {
        "due",
        "partial",
        "paid",
        "waived",
        "overdue",
        None,
    }:
        raise HTTPException(400, "Statut invalide")
    for key, val in data.items():
        setattr(inst, key, val)
    if inst.amount is not None and inst.amount < 0:
        raise HTTPException(400, "Montant invalide")
    # Ajuster statut auto si montant payé change
    if inst.amount_paid is not None and inst.amount is not None:
        if inst.amount_paid >= inst.amount and inst.amount > 0:
            inst.status = "paid"
        elif inst.amount_paid > 0 and inst.status == "paid":
            inst.status = "partial"
    # Numéro / réf immuables si absents
    if not getattr(inst, "seq_no", None):
        q = db.query(func.coalesce(func.max(FeeInstallment.seq_no), 0)).filter(
            or_(FeeInstallment.club_id == club_id, FeeInstallment.club_id.is_(None))
        )
        inst.seq_no = int(q.scalar() or 0) + 1
    if not getattr(inst, "reference", None):
        year = inst.due_date.year if inst.due_date else date.today().year
        inst.reference = build_op_reference("ECH", year, int(inst.seq_no))
    write_audit(
        db,
        action="update",
        entity="fee_installment",
        entity_id=inst.id,
        user_id=user.id,
        detail=f"status={inst.status} due={inst.due_date}",
    )
    db.commit()
    db.refresh(inst)
    cache_delete_prefix("finance:")
    names = _athlete_names(db, [inst.athlete_id])
    return _installment_out(inst, names)


@router.delete("/installments/{installment_id}")
def delete_installment(
    installment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Supprime une échéance (admin/direction). Les paiements liés restent en historique."""
    inst = db.get(FeeInstallment, installment_id)
    if not inst:
        raise HTTPException(404, "Échéance introuvable")
    assert_same_club(inst, club_id)
    # Détacher les paiements pour garder l'historique encaissements
    for pay in db.query(Payment).filter(Payment.installment_id == installment_id).all():
        pay.installment_id = None
    label = inst.label
    db.delete(inst)
    from app.services.audit import write_audit

    write_audit(
        db,
        action="delete",
        entity="fee_installment",
        entity_id=installment_id,
        user_id=user.id,
        club_id=club_id,
        detail=label,
        commit=True,
    )
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {"deleted": installment_id}


@router.post("/payments")
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    payment = Payment(**payload.model_dump(), club_id=club_id, recorded_by=user.id)
    assign_payment_identity(db, payment, club_id=club_id)
    db.add(payment)
    db.flush()

    if payload.installment_id:
        inst = db.get(FeeInstallment, payload.installment_id)
        if not inst:
            raise HTTPException(404, "Échéance introuvable")
        assert_same_club(inst, club_id)
        _apply_payment_to_installment(inst, payload.amount)

    receipt = _make_receipt(db, payment.id, club_id)
    athlete = db.get(Athlete, payload.athlete_id)
    _ledger_income_for_payment(
        db,
        club_id=club_id,
        season_id=None,
        label=f"Paiement — {athlete.full_name if athlete else payload.athlete_id}",
        amount=payload.amount,
        paid_on=payload.paid_on,
        user_id=user.id,
    )
    write_audit(
        db,
        action="create",
        entity="payment",
        entity_id=payment.id,
        user_id=user.id,
        detail=f"athlete={payload.athlete_id} amount={payload.amount}",
    )
    db.commit()
    db.refresh(payment)
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {
        "payment_id": payment.id,
        "receipt_number": receipt.number,
        "amount": float(payment.amount),
    }


@router.post("/payments/quick")
def create_quick_payment(
    payload: QuickPaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """UX : type de paiement → joueur (catégorie côté client) → enregistrement."""
    athlete = db.get(Athlete, payload.athlete_id)
    if not athlete:
        raise HTTPException(404, "Joueur introuvable")
    assert_same_club(athlete, club_id)

    season_id = payload.season_id or _current_season_id(db)
    if not season_id:
        raise HTTPException(400, "Aucune saison courante")

    fees = get_fee_settings(db, club_id=club_id)
    paid_on = payload.paid_on or date.today()
    ptype = (payload.payment_type or "").strip().lower()
    installment: FeeInstallment | None = None
    amount = payload.amount
    ledger_category = "subscription"
    display = athlete.full_name

    reg = (
        db.query(Registration)
        .filter(Registration.athlete_id == athlete.id, Registration.season_id == season_id)
        .order_by(Registration.id.desc())
        .first()
    )

    if ptype == "monthly":
        today = paid_on
        year = payload.year or today.year
        month = payload.month or today.month
        if month < 1 or month > 12:
            raise HTTPException(400, "Mois invalide (1–12)")
        amount = amount if amount is not None else fees["monthly_subscription_dzd"]
        installment = ensure_monthly_installment(
            db,
            athlete_id=athlete.id,
            season_id=season_id,
            year=year,
            month=month,
            amount=amount,
            registration_id=reg.id if reg else None,
        )
        fr, _ = monthly_label_display(year, month)
        label = f"Abonnement {fr} — {display}"
    elif ptype == "insurance":
        amount = amount if amount is not None else fees["annual_insurance_dzd"]
        if reg:
            installment = ensure_insurance_installment(db, reg, amount)
        else:
            installment = (
                db.query(FeeInstallment)
                .filter(
                    FeeInstallment.athlete_id == athlete.id,
                    FeeInstallment.season_id == season_id,
                    FeeInstallment.label == "assurance",
                )
                .first()
            )
            if not installment:
                installment = FeeInstallment(
                    club_id=club_id,
                    athlete_id=athlete.id,
                    season_id=season_id,
                    label="assurance",
                    label_ar="التأمين السنوي",
                    due_date=paid_on,
                    amount=amount,
                    amount_paid=Decimal("0"),
                    status="due",
                )
                db.add(installment)
                db.flush()
        label = f"Assurance annuelle — {display}"
        ledger_category = "insurance"
    elif ptype == "inscription":
        amount = amount if amount is not None else fees["inscription_fee_dzd"]
        if reg:
            if reg.subscription_fee is None or Decimal(str(reg.subscription_fee)) <= 0:
                reg.subscription_fee = amount
            installment = ensure_subscription_installment(db, reg)
        if not installment:
            installment = FeeInstallment(
                club_id=club_id,
                athlete_id=athlete.id,
                season_id=season_id,
                registration_id=reg.id if reg else None,
                label="inscription",
                label_ar="حقوق الاشتراك",
                due_date=paid_on,
                amount=amount,
                amount_paid=Decimal("0"),
                status="due",
            )
            db.add(installment)
            db.flush()
        label = f"Inscription — {display}"
    elif ptype == "equipment":
        eq = (payload.equipment_label or "équipement").strip()
        amount = amount if amount is not None else Decimal("0")
        if amount <= 0:
            raise HTTPException(400, "Montant équipement requis")
        label = f"Équipement ({eq}) — {display}"
        ledger_category = "equipment"
        installment = FeeInstallment(
            club_id=club_id,
            athlete_id=athlete.id,
            season_id=season_id,
            registration_id=reg.id if reg else None,
            label=f"equipement-{eq[:40]}",
            label_ar="تجهيز",
            due_date=paid_on,
            amount=amount,
            amount_paid=Decimal("0"),
            status="due",
        )
        db.add(installment)
        db.flush()
    else:
        raise HTTPException(
            400,
            "Type de paiement invalide (monthly | insurance | inscription | equipment)",
        )

    if amount is None or amount <= 0:
        raise HTTPException(400, "Montant invalide")

    if installment is not None and getattr(installment, "club_id", None) is None:
        installment.club_id = club_id
    if installment is not None:
        assign_installment_identity(db, installment, club_id=club_id)

    payment = Payment(
        installment_id=installment.id if installment else None,
        club_id=club_id,
        athlete_id=athlete.id,
        amount=amount,
        method=payload.method or "cash",
        paid_on=paid_on,
        recorded_by=user.id,
        notes=payload.notes,
    )
    assign_payment_identity(db, payment, club_id=club_id)
    db.add(payment)
    db.flush()
    if installment:
        _apply_payment_to_installment(installment, amount)

    receipt = _make_receipt(db, payment.id, club_id)
    _ledger_income_for_payment(
        db,
        club_id=club_id,
        season_id=season_id,
        label=label,
        amount=amount,
        paid_on=paid_on,
        user_id=user.id,
        category=ledger_category,
    )

    write_audit(
        db,
        action="create",
        entity="payment",
        entity_id=payment.id,
        user_id=user.id,
        detail=f"type={ptype} athlete={athlete.id} amount={amount}",
    )
    db.commit()
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {
        "ok": True,
        "payment_id": payment.id,
        "receipt_number": receipt.number,
        "amount": float(amount),
        "payment_type": ptype,
        "athlete_id": athlete.id,
        "athlete_name": display,
        "installment_id": installment.id if installment else None,
        "label": label,
    }


@router.get("/payments/recent")
def list_recent_payments(
    athlete_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(Payment).filter(or_(Payment.club_id == club_id, Payment.club_id.is_(None)))
    if athlete_id:
        q = q.filter(Payment.athlete_id == athlete_id)
    rows = q.order_by(Payment.id.desc()).offset(skip).limit(limit).all()
    names = _athlete_names(db, [r.athlete_id for r in rows])
    return [
        {
            "id": r.id,
            "seq_no": getattr(r, "seq_no", None),
            "reference": r.reference,
            "athlete_id": r.athlete_id,
            "athlete_name": names.get(r.athlete_id),
            "amount": float(r.amount),
            "method": r.method,
            "paid_on": r.paid_on.isoformat() if r.paid_on else None,
            "installment_id": r.installment_id,
            "notes": r.notes,
        }
        for r in rows
    ]


@router.get("/ledger", response_model=list[LedgerOut])
def list_ledger(
    entry_type: str | None = None,
    include_archived: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(LedgerEntry).filter(
        or_(LedgerEntry.club_id == club_id, LedgerEntry.club_id.is_(None))
    )
    if not include_archived:
        q = q.filter(or_(LedgerEntry.is_archived.is_(False), LedgerEntry.is_archived.is_(None)))
    if entry_type:
        q = q.filter(LedgerEntry.entry_type == entry_type)
    return q.order_by(LedgerEntry.entry_date.desc()).offset(skip).limit(limit).all()


@router.post("/ledger", response_model=LedgerOut)
def create_ledger(
    payload: LedgerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    entry = LedgerEntry(club_id=club_id, created_by=user.id, **payload.model_dump())
    assign_ledger_identity(db, entry, club_id=club_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return entry


@router.patch("/ledger/{entry_id}", response_model=LedgerOut)
def update_ledger(
    entry_id: int,
    payload: LedgerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    entry = db.get(LedgerEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Ligne introuvable")
    assert_same_club(entry, club_id)
    data = payload.model_dump(exclude_unset=True)
    data.pop("reference", None)
    data.pop("seq_no", None)
    for key, val in data.items():
        setattr(entry, key, val)
    db.commit()
    db.refresh(entry)
    write_audit(
        db,
        action="update",
        entity="ledger",
        entity_id=entry.id,
        user_id=user.id,
        detail=entry.label,
        commit=True,
    )
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return entry


@router.delete("/ledger/{entry_id}")
def delete_ledger(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Soft-delete caisse — récupérable via POST /ledger/{id}/restore."""
    entry = db.get(LedgerEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Ligne introuvable")
    assert_same_club(entry, club_id)
    label = entry.label
    entry.is_archived = True
    write_audit(
        db,
        action="delete",
        entity="ledger",
        entity_id=entry_id,
        user_id=user.id,
        detail=label,
        commit=True,
    )
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {"ok": True, "soft": True, "archived": True}


@router.post("/ledger/{entry_id}/restore", response_model=LedgerOut)
def restore_ledger(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    entry = db.get(LedgerEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Ligne introuvable")
    assert_same_club(entry, club_id)
    entry.is_archived = False
    write_audit(
        db,
        action="restore",
        entity="ledger",
        entity_id=entry.id,
        user_id=user.id,
        detail=entry.label,
        commit=True,
    )
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    db.refresh(entry)
    return entry


@router.patch("/payments/{payment_id}")
def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Paiement introuvable")
    assert_same_club(payment, club_id)
    old_amount = payment.amount
    data = payload.model_dump(exclude_unset=True)
    # Référence / N° immuables — ne jamais écraser
    data.pop("reference", None)
    data.pop("seq_no", None)
    for key, val in data.items():
        setattr(payment, key, val)
    # Ajuste l'échéance liée si le montant change
    if "amount" in data and payment.installment_id:
        inst = db.get(FeeInstallment, payment.installment_id)
        if inst:
            delta = Decimal(str(payment.amount)) - Decimal(str(old_amount))
            inst.amount_paid = Decimal(str(inst.amount_paid or 0)) + delta
            if inst.amount_paid < 0:
                inst.amount_paid = Decimal("0")
            if inst.amount_paid >= inst.amount:
                inst.status = "paid"
                inst.amount_paid = inst.amount
            elif inst.amount_paid > 0:
                inst.status = "partial"
            else:
                inst.status = "due"
    db.commit()
    write_audit(
        db,
        action="update",
        entity="payment",
        entity_id=payment.id,
        user_id=user.id,
        detail=f"amount={payment.amount}",
        commit=True,
    )
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    names = _athlete_names(db, [payment.athlete_id])
    return {
        "id": payment.id,
        "athlete_id": payment.athlete_id,
        "athlete_name": names.get(payment.athlete_id),
        "amount": float(payment.amount),
        "method": payment.method,
        "paid_on": payment.paid_on.isoformat() if payment.paid_on else None,
        "installment_id": payment.installment_id,
        "notes": payment.notes,
    }


@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Supprime un paiement et retire le montant de l'échéance liée."""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Paiement introuvable")
    assert_same_club(payment, club_id)
    if payment.installment_id:
        inst = db.get(FeeInstallment, payment.installment_id)
        if inst:
            inst.amount_paid = Decimal(str(inst.amount_paid or 0)) - Decimal(str(payment.amount))
            if inst.amount_paid < 0:
                inst.amount_paid = Decimal("0")
            if inst.amount_paid <= 0:
                inst.status = "due"
            elif inst.amount_paid < inst.amount:
                inst.status = "partial"
            else:
                inst.status = "paid"
    detail = f"athlete={payment.athlete_id} amount={payment.amount}"
    db.delete(payment)
    write_audit(
        db,
        action="delete",
        entity="payment",
        entity_id=payment_id,
        user_id=user.id,
        club_id=club_id,
        detail=detail,
    )
    db.commit()
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {"deleted": payment_id}


@router.get("/dashboard")
def finance_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    cached = cache_get(f"finance:dashboard:{club_id}")
    if cached is not None:
        return cached

    def _cf(model):
        return or_(model.club_id == club_id, model.club_id.is_(None))

    due = db.query(func.coalesce(func.sum(FeeInstallment.amount - FeeInstallment.amount_paid), 0)).filter(
        FeeInstallment.status.in_(["due", "partial", "overdue"]), _cf(FeeInstallment)
    ).scalar()
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(_cf(Payment)).scalar()
    income = db.query(func.coalesce(func.sum(LedgerEntry.amount), 0)).filter(
        LedgerEntry.entry_type == "income",
        _cf(LedgerEntry),
        or_(LedgerEntry.is_archived.is_(False), LedgerEntry.is_archived.is_(None)),
    ).scalar()
    expense = db.query(func.coalesce(func.sum(LedgerEntry.amount), 0)).filter(
        LedgerEntry.entry_type == "expense",
        _cf(LedgerEntry),
        or_(LedgerEntry.is_archived.is_(False), LedgerEntry.is_archived.is_(None)),
    ).scalar()
    payroll = db.query(func.coalesce(func.sum(CoachPayroll.amount), 0)).filter(_cf(CoachPayroll)).scalar()
    overdue_count = (
        db.query(func.count(FeeInstallment.id))
        .filter(FeeInstallment.status == "overdue", _cf(FeeInstallment))
        .scalar()
        or 0
    )
    fees = get_fee_settings(db, club_id=club_id)
    payload = {
        "currency": "DZD",
        "cotisations_due": float(due or 0),
        "cotisations_paid": float(paid or 0),
        "ledger_income": float(income or 0),
        "ledger_expense": float(expense or 0),
        "coach_payroll_total": float(payroll or 0),
        "overdue_count": int(overdue_count),
        "monthly_subscription_dzd": float(fees["monthly_subscription_dzd"]),
        "annual_insurance_dzd": float(fees["annual_insurance_dzd"]),
        "inscription_fee_dzd": float(fees["inscription_fee_dzd"]),
    }
    cache_set(f"finance:dashboard:{club_id}", payload, 40)
    return payload


@router.get("/payroll")
def list_payroll(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    rows = (
        db.query(CoachPayroll)
        .filter(or_(CoachPayroll.club_id == club_id, CoachPayroll.club_id.is_(None)))
        .order_by(CoachPayroll.id.desc())
        .limit(300)
        .all()
    )
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "label": r.label,
            "pay_type": r.pay_type,
            "amount": float(r.amount),
            "period_month": r.period_month,
            "period_year": r.period_year,
            "status": r.status,
            "paid_on": r.paid_on,
        }
        for r in rows
    ]


inv_router = APIRouter(prefix="/inventory", tags=["inventory"])


@inv_router.get("/items", response_model=list[InventoryItemOut])
def list_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    cached = cache_get(f"inventory:items:{club_id}")
    if cached is not None:
        return cached
    rows = (
        db.query(InventoryItem)
        .filter(or_(InventoryItem.club_id == club_id, InventoryItem.club_id.is_(None)))
        .order_by(InventoryItem.name)
        .all()
    )
    out = [InventoryItemOut.model_validate(r) for r in rows]
    cache_set(f"inventory:items:{club_id}", out, 45)
    return out


@inv_router.post("/items", response_model=InventoryItemOut)
def create_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    item = InventoryItem(club_id=club_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    cache_delete_prefix("inventory:")
    return item


@inv_router.patch("/items/{item_id}", response_model=InventoryItemOut)
def update_item(
    item_id: int,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Article introuvable")
    assert_same_club(item, club_id)
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, val)
    if item.quantity < 0:
        raise HTTPException(400, "Quantité invalide")
    db.commit()
    db.refresh(item)
    write_audit(
        db,
        action="update",
        entity="inventory_item",
        entity_id=item.id,
        user_id=user.id,
        detail=item.name,
        commit=True,
    )
    cache_delete_prefix("inventory:")
    return item


@inv_router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Article introuvable")
    assert_same_club(item, club_id)
    open_asg = (
        db.query(InventoryAssignment)
        .filter(InventoryAssignment.item_id == item_id, InventoryAssignment.status == "out")
        .count()
    )
    if open_asg:
        raise HTTPException(
            400,
            f"{open_asg} attribution(s) encore sorties — retournez-les avant de supprimer l'article.",
        )
    name = item.name
    db.delete(item)
    write_audit(
        db,
        action="delete",
        entity="inventory_item",
        entity_id=item_id,
        user_id=user.id,
        club_id=club_id,
        detail=name,
    )
    db.commit()
    cache_delete_prefix("inventory:")
    return {"deleted": item_id}


@inv_router.get("/alerts")
def inventory_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    items = (
        db.query(InventoryItem)
        .filter(or_(InventoryItem.club_id == club_id, InventoryItem.club_id.is_(None)))
        .all()
    )
    return [
        {"id": i.id, "name": i.name, "quantity": i.quantity, "alert_threshold": i.alert_threshold}
        for i in items
        if i.quantity <= i.alert_threshold
    ]


@inv_router.post("/assign")
def assign_item(
    item_id: int,
    athlete_id: int | None = None,
    quantity: int = 1,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Article introuvable")
    assert_same_club(item, club_id)
    if item.quantity < quantity:
        raise HTTPException(400, "Stock insuffisant")
    item.quantity -= quantity
    asg = InventoryAssignment(
        club_id=club_id,
        item_id=item_id,
        athlete_id=athlete_id,
        user_id=user.id,
        quantity=quantity,
        assigned_on=date.today(),
    )
    db.add(asg)
    db.commit()
    cache_delete_prefix("inventory:")
    return {"ok": True, "remaining": item.quantity}


@inv_router.get("/assignments")
def list_assignments(
    athlete_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    q = db.query(InventoryAssignment).filter(
        or_(InventoryAssignment.club_id == club_id, InventoryAssignment.club_id.is_(None))
    )
    if athlete_id:
        q = q.filter(InventoryAssignment.athlete_id == athlete_id)
    rows = q.order_by(InventoryAssignment.id.desc()).offset(skip).limit(limit).all()
    item_ids = list({r.item_id for r in rows})
    items = {i.id: i for i in db.query(InventoryItem).filter(InventoryItem.id.in_(item_ids)).all()} if item_ids else {}
    names = _athlete_names(db, [r.athlete_id for r in rows if r.athlete_id])
    return [
        {
            "id": r.id,
            "item_id": r.item_id,
            "item_name": items[r.item_id].name if r.item_id in items else None,
            "item_kind": getattr(items[r.item_id], "item_kind", None) if r.item_id in items else None,
            "athlete_id": r.athlete_id,
            "athlete_name": names.get(r.athlete_id) if r.athlete_id else None,
            "quantity": r.quantity,
            "assigned_on": r.assigned_on.isoformat() if r.assigned_on else None,
            "status": r.status,
            "season_id": getattr(r, "season_id", None),
            "notes": getattr(r, "notes", None),
        }
        for r in rows
    ]


@inv_router.patch("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    payload: InventoryAssignmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    asg = db.get(InventoryAssignment, assignment_id)
    if not asg:
        raise HTTPException(404, "Attribution introuvable")
    assert_same_club(asg, club_id)
    item = db.get(InventoryItem, asg.item_id)
    data = payload.model_dump(exclude_unset=True)
    old_qty = asg.quantity
    old_status = asg.status

    if "quantity" in data and item:
        new_qty = int(data["quantity"])
        if new_qty < 1:
            raise HTTPException(400, "Quantité invalide")
        delta = new_qty - old_qty
        if delta > 0 and item.quantity < delta:
            raise HTTPException(400, "Stock insuffisant")
        item.quantity -= delta
        asg.quantity = new_qty

    if "athlete_id" in data:
        asg.athlete_id = data["athlete_id"]
    if "assigned_on" in data and data["assigned_on"]:
        asg.assigned_on = data["assigned_on"]
    if "status" in data and data["status"]:
        new_status = data["status"]
        if new_status not in {"out", "returned", "lost"}:
            raise HTTPException(400, "Statut invalide")
        # Retour stock si passage out → returned
        if old_status == "out" and new_status == "returned" and item:
            item.quantity += asg.quantity
            asg.returned_on = data.get("returned_on") or date.today()
        if new_status == "out" and old_status == "returned" and item:
            if item.quantity < asg.quantity:
                raise HTTPException(400, "Stock insuffisant pour re-attribuer")
            item.quantity -= asg.quantity
            asg.returned_on = None
        asg.status = new_status
    if "returned_on" in data:
        asg.returned_on = data["returned_on"]

    db.commit()
    write_audit(
        db,
        action="update",
        entity="inventory_assignment",
        entity_id=asg.id,
        user_id=user.id,
        detail=f"status={asg.status}",
        commit=True,
    )
    cache_delete_prefix("inventory:")
    names = _athlete_names(db, [asg.athlete_id] if asg.athlete_id else [])
    return {
        "id": asg.id,
        "item_id": asg.item_id,
        "item_name": item.name if item else None,
        "athlete_id": asg.athlete_id,
        "athlete_name": names.get(asg.athlete_id) if asg.athlete_id else None,
        "quantity": asg.quantity,
        "assigned_on": asg.assigned_on.isoformat() if asg.assigned_on else None,
        "status": asg.status,
    }


@inv_router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    restock: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    asg = db.get(InventoryAssignment, assignment_id)
    if not asg:
        raise HTTPException(404, "Attribution introuvable")
    assert_same_club(asg, club_id)
    item = db.get(InventoryItem, asg.item_id)
    if restock and asg.status == "out" and item:
        item.quantity += asg.quantity
    write_audit(
        db,
        action="delete",
        entity="inventory_assignment",
        entity_id=asg.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"item={asg.item_id} athlete={asg.athlete_id}",
    )
    db.delete(asg)
    db.commit()
    cache_delete_prefix("inventory:")
    return {"deleted": assignment_id}


@inv_router.post("/purchase")
def purchase_equipment(
    payload: EquipmentPurchaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Achat équipement (stock) + dépense caisse ; optionnellement attribué à un joueur."""
    if payload.quantity < 1:
        raise HTTPException(400, "Quantité invalide")
    entry_date = payload.entry_date or date.today()
    total = Decimal(str(payload.unit_cost)) * payload.quantity

    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.club_id == club_id, InventoryItem.name == payload.name.strip())
        .first()
    )
    if item:
        item.quantity += payload.quantity
        if payload.item_kind and payload.item_kind != "other":
            item.item_kind = payload.item_kind
    else:
        item = InventoryItem(
            club_id=club_id,
            name=payload.name.strip(),
            quantity=payload.quantity,
            alert_threshold=2,
            location=payload.location,
            notes=payload.notes,
            item_kind=payload.item_kind or "other",
        )
        db.add(item)
        db.flush()

    if total > 0:
        entry = LedgerEntry(
            club_id=club_id,
            entry_type="expense",
            category="equipment",
            label=f"Achat {payload.name} ×{payload.quantity}",
            amount=total,
            entry_date=entry_date,
            notes=payload.notes,
            created_by=user.id,
        )
        assign_ledger_identity(db, entry, club_id=club_id)
        db.add(entry)

    assigned = None
    if payload.athlete_id:
        athlete = db.get(Athlete, payload.athlete_id)
        if not athlete:
            raise HTTPException(404, "Joueur introuvable")
        assert_same_club(athlete, club_id)
        if item.quantity < 1:
            raise HTTPException(400, "Stock insuffisant pour attribution")
        qty = min(payload.quantity, item.quantity)
        item.quantity -= qty
        asg = InventoryAssignment(
            club_id=club_id,
            item_id=item.id,
            athlete_id=payload.athlete_id,
            user_id=user.id,
            quantity=qty,
            assigned_on=entry_date,
        )
        db.add(asg)
        assigned = {"athlete_id": athlete.id, "athlete_name": athlete.full_name, "quantity": qty}

    db.commit()
    cache_delete_prefix("inventory:")
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return {
        "ok": True,
        "item_id": item.id,
        "name": item.name,
        "stock": item.quantity,
        "total_cost": float(total),
        "assigned": assigned,
    }
