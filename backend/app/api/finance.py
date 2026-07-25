from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
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
    InventoryItemCreate,
    InventoryItemOut,
    LedgerCreate,
    LedgerOut,
    PaymentCreate,
    QuickPaymentCreate,
)
from app.services.fast_cache import cache_delete_prefix, cache_get, cache_set
from app.services.fees import (
    DEFAULT_SETTINGS,
    ensure_default_settings,
    ensure_insurance_installment,
    ensure_monthly_installment,
    ensure_subscription_installment,
    get_fee_settings,
    monthly_label_display,
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


def _make_receipt(db: Session, payment_id: int) -> Receipt:
    count = db.query(func.count(Receipt.id)).scalar() or 0
    receipt = Receipt(payment_id=payment_id, number=f"WRBH-{date.today().year}-{count + 1:05d}")
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
    db.add(
        LedgerEntry(
            club_id=club_id,
            season_id=season_id,
            entry_type="income",
            category=category,
            label=label,
            amount=amount,
            entry_date=paid_on,
            created_by=user_id,
        )
    )


@router.get("/finance/settings", response_model=ClubFeeSettingsOut)
def get_finance_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
):
    fees = get_fee_settings(db)
    return ClubFeeSettingsOut(
        monthly_subscription_dzd=fees["monthly_subscription_dzd"],
        annual_insurance_dzd=fees["annual_insurance_dzd"],
        inscription_fee_dzd=fees["inscription_fee_dzd"],
    )


@router.put("/finance/settings", response_model=ClubFeeSettingsOut)
def update_finance_settings(
    payload: ClubFeeSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    club = db.query(Club).first()
    if not club:
        raise HTTPException(400, "Club introuvable")
    ensure_default_settings(db)
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
            .filter(ClubSetting.club_id == club.id, ClubSetting.key == key)
            .first()
        )
        if row:
            row.value = str(val)
        else:
            meta = DEFAULT_SETTINGS[key]
            db.add(
                ClubSetting(
                    club_id=club.id,
                    key=key,
                    value=str(val),
                    label=meta[1],
                    label_ar=meta[2],
                )
            )
    db.commit()
    cache_delete_prefix("finance:")
    fees = get_fee_settings(db)
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
):
    q = db.query(FeeInstallment)
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


@router.post("/payments")
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    payment = Payment(**payload.model_dump(), recorded_by=user.id)
    db.add(payment)
    db.flush()

    if payload.installment_id:
        inst = db.get(FeeInstallment, payload.installment_id)
        if not inst:
            raise HTTPException(404, "Échéance introuvable")
        _apply_payment_to_installment(inst, payload.amount)

    receipt = _make_receipt(db, payment.id)
    club = db.query(Club).first()
    if club:
        athlete = db.get(Athlete, payload.athlete_id)
        _ledger_income_for_payment(
            db,
            club_id=club.id,
            season_id=None,
            label=f"Paiement — {athlete.full_name if athlete else payload.athlete_id}",
            amount=payload.amount,
            paid_on=payload.paid_on,
            user_id=user.id,
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
):
    """UX : type de paiement → joueur (catégorie côté client) → enregistrement."""
    athlete = db.get(Athlete, payload.athlete_id)
    if not athlete:
        raise HTTPException(404, "Joueur introuvable")

    season_id = payload.season_id or _current_season_id(db)
    if not season_id:
        raise HTTPException(400, "Aucune saison courante")

    fees = get_fee_settings(db)
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

    payment = Payment(
        installment_id=installment.id if installment else None,
        athlete_id=athlete.id,
        amount=amount,
        method=payload.method or "cash",
        paid_on=paid_on,
        recorded_by=user.id,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()
    if installment:
        _apply_payment_to_installment(installment, amount)

    receipt = _make_receipt(db, payment.id)
    club = db.query(Club).first()
    if club:
        _ledger_income_for_payment(
            db,
            club_id=club.id,
            season_id=season_id,
            label=label,
            amount=amount,
            paid_on=paid_on,
            user_id=user.id,
            category=ledger_category,
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
    skip: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    rows = db.query(Payment).order_by(Payment.id.desc()).offset(skip).limit(limit).all()
    names = _athlete_names(db, [r.athlete_id for r in rows])
    return [
        {
            "id": r.id,
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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    q = db.query(LedgerEntry)
    if entry_type:
        q = q.filter(LedgerEntry.entry_type == entry_type)
    return q.order_by(LedgerEntry.entry_date.desc()).offset(skip).limit(limit).all()


@router.post("/ledger", response_model=LedgerOut)
def create_ledger(
    payload: LedgerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    club = db.query(Club).first()
    entry = LedgerEntry(club_id=club.id, created_by=user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    cache_delete_prefix("finance:")
    cache_delete_prefix("bootstrap:")
    return entry


@router.get("/dashboard")
def finance_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    cached = cache_get("finance:dashboard")
    if cached is not None:
        return cached
    due = db.query(func.coalesce(func.sum(FeeInstallment.amount - FeeInstallment.amount_paid), 0)).filter(
        FeeInstallment.status.in_(["due", "partial", "overdue"])
    ).scalar()
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar()
    income = db.query(func.coalesce(func.sum(LedgerEntry.amount), 0)).filter(
        LedgerEntry.entry_type == "income"
    ).scalar()
    expense = db.query(func.coalesce(func.sum(LedgerEntry.amount), 0)).filter(
        LedgerEntry.entry_type == "expense"
    ).scalar()
    payroll = db.query(func.coalesce(func.sum(CoachPayroll.amount), 0)).scalar()
    overdue_count = (
        db.query(func.count(FeeInstallment.id)).filter(FeeInstallment.status == "overdue").scalar() or 0
    )
    fees = get_fee_settings(db)
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
    cache_set("finance:dashboard", payload, 40)
    return payload


@router.get("/payroll")
def list_payroll(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    rows = db.query(CoachPayroll).order_by(CoachPayroll.id.desc()).limit(300).all()
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
def list_items(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cached = cache_get("inventory:items")
    if cached is not None:
        return cached
    rows = db.query(InventoryItem).order_by(InventoryItem.name).all()
    out = [InventoryItemOut.model_validate(r) for r in rows]
    cache_set("inventory:items", out, 45)
    return out


@inv_router.post("/items", response_model=InventoryItemOut)
def create_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    club = db.query(Club).first()
    item = InventoryItem(club_id=club.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    cache_delete_prefix("inventory:")
    return item


@inv_router.get("/alerts")
def inventory_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    items = db.query(InventoryItem).all()
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
):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Article introuvable")
    if item.quantity < quantity:
        raise HTTPException(400, "Stock insuffisant")
    item.quantity -= quantity
    asg = InventoryAssignment(
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
):
    q = db.query(InventoryAssignment)
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
            "athlete_id": r.athlete_id,
            "athlete_name": names.get(r.athlete_id) if r.athlete_id else None,
            "quantity": r.quantity,
            "assigned_on": r.assigned_on.isoformat() if r.assigned_on else None,
            "status": r.status,
        }
        for r in rows
    ]


@inv_router.post("/purchase")
def purchase_equipment(
    payload: EquipmentPurchaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    """Achat équipement (stock) + dépense caisse ; optionnellement attribué à un joueur."""
    if payload.quantity < 1:
        raise HTTPException(400, "Quantité invalide")
    club = db.query(Club).first()
    if not club:
        raise HTTPException(400, "Club introuvable")
    entry_date = payload.entry_date or date.today()
    total = Decimal(str(payload.unit_cost)) * payload.quantity

    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.club_id == club.id, InventoryItem.name == payload.name.strip())
        .first()
    )
    if item:
        item.quantity += payload.quantity
    else:
        item = InventoryItem(
            club_id=club.id,
            name=payload.name.strip(),
            quantity=payload.quantity,
            alert_threshold=2,
            location=payload.location,
            notes=payload.notes,
        )
        db.add(item)
        db.flush()

    if total > 0:
        db.add(
            LedgerEntry(
                club_id=club.id,
                entry_type="expense",
                category="equipment",
                label=f"Achat {payload.name} ×{payload.quantity}",
                amount=total,
                entry_date=entry_date,
                notes=payload.notes,
                created_by=user.id,
            )
        )

    assigned = None
    if payload.athlete_id:
        athlete = db.get(Athlete, payload.athlete_id)
        if not athlete:
            raise HTTPException(404, "Joueur introuvable")
        if item.quantity < 1:
            raise HTTPException(400, "Stock insuffisant pour attribution")
        qty = min(payload.quantity, item.quantity)
        item.quantity -= qty
        asg = InventoryAssignment(
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
