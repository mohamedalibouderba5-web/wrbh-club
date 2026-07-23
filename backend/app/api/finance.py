from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.models import (
    Club,
    CoachPayroll,
    FeeInstallment,
    InventoryAssignment,
    InventoryItem,
    LedgerEntry,
    ParentChild,
    Payment,
    Receipt,
    User,
)
from app.schemas import (
    InstallmentOut,
    InventoryItemCreate,
    InventoryItemOut,
    LedgerCreate,
    LedgerOut,
    PaymentCreate,
)

router = APIRouter(tags=["finance"])


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
    return q.order_by(FeeInstallment.due_date.nulls_last()).offset(skip).limit(limit).all()


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
        inst.amount_paid = (inst.amount_paid or Decimal("0")) + payload.amount
        if inst.amount_paid >= inst.amount:
            inst.status = "paid"
        elif inst.amount_paid > 0:
            inst.status = "partial"

    count = db.query(func.count(Receipt.id)).scalar() or 0
    receipt = Receipt(payment_id=payment.id, number=f"WRBH-{date.today().year}-{count + 1:05d}")
    db.add(receipt)
    db.commit()
    db.refresh(payment)
    return {
        "payment_id": payment.id,
        "receipt_number": receipt.number,
        "amount": float(payment.amount),
    }


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
    return entry


@router.get("/dashboard")
def finance_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
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
    overdue_count = db.query(FeeInstallment).filter(FeeInstallment.status == "overdue").count()
    return {
        "currency": "DZD",
        "cotisations_due": float(due or 0),
        "cotisations_paid": float(paid or 0),
        "ledger_income": float(income or 0),
        "ledger_expense": float(expense or 0),
        "coach_payroll_total": float(payroll or 0),
        "overdue_count": overdue_count,
    }


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
    return db.query(InventoryItem).order_by(InventoryItem.name).all()


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
    return {"ok": True, "remaining": item.quantity}
