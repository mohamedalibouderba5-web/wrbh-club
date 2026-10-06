"""Diffusion des notifications métier par rôle (admin / finance / coach / parent)."""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.roles import Role
from app.models import FeeInstallment
from app.services.fees import get_fee_settings
from app.services.notify import notify_parents_of_athlete, notify_roles, notify_team_coaches, notify_user
from app.services.parental import event_body, event_headline


def fanout_session_lifecycle(
    db: Session,
    *,
    club_id: int,
    event,
    action: str,
    reason: str | None = None,
) -> dict[str, int]:
    """action: create | cancel | start | end."""
    title_map = {
        "create": f"Nouvelle séance / حصة جديدة — {event_headline(event)}",
        "cancel": f"Séance annulée / إلغاء الحصة — {event.title}",
        "start": f"Séance démarrée / بدأت الحصة — {event.title}",
        "end": f"Séance terminée / انتهت الحصة — {event.title}",
    }
    kind_map = {
        "create": "session_create",
        "cancel": "cancel",
        "start": "session_start",
        "end": "session_end",
    }
    title = title_map.get(action, event.title)
    body = event_body(event, reason or "")
    kind = kind_map.get(action, "info")

    managers = notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value],
        title,
        body,
        kind=kind,
        club_id=club_id,
        link="/agenda",
    )
    coaches = 0
    if getattr(event, "team_id", None):
        coaches = notify_team_coaches(
            db,
            int(event.team_id),
            title,
            body,
            kind=kind,
            club_id=club_id,
            link="/agenda",
        )
    for cid in (getattr(event, "coach_id", None), getattr(event, "substitute_coach_id", None)):
        if cid:
            notify_user(db, int(cid), title, body, kind=kind, club_id=club_id, link="/agenda")
            coaches += 1
    return {"managers": managers, "coaches": coaches}


def fanout_finance_expense(
    db: Session,
    *,
    club_id: int,
    label: str,
    amount,
    category: str = "expense",
) -> int:
    title = f"Dépense / مصروف — {label}"
    body = f"{amount} DZD · {category}"
    return notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value, Role.STAFF.value],
        title,
        body,
        kind="finance_expense",
        club_id=club_id,
        link="/finance",
    )


def fanout_finance_income(
    db: Session,
    *,
    club_id: int,
    label: str,
    amount,
    athlete_id: int | None = None,
) -> dict[str, int]:
    title = f"Encaissement / تحصيل — {label}"
    body = f"{amount} DZD"
    managers = notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value, Role.STAFF.value],
        title,
        body,
        kind="finance_income",
        club_id=club_id,
        link="/finance",
    )
    parents = 0
    if athlete_id:
        parents = notify_parents_of_athlete(
            db,
            athlete_id,
            f"Paiement enregistré / تم الدفع — {label}",
            body + " · Merci / شكراً",
            kind="payment_parent",
            club_id=club_id,
            link="/",
        )
    return {"staff": managers, "parents": parents}


def fanout_parent_payment_balance(
    db: Session,
    *,
    club_id: int,
    athlete_id: int,
    athlete_name: str,
    amount_paid,
) -> int:
    """Explique au parent la répartition cotisation + mois restants approximatifs."""
    fees = get_fee_settings(db, club_id=club_id)
    monthly = fees.get("monthly_subscription_dzd") or Decimal("800")
    insurance = fees.get("annual_insurance_dzd") or Decimal("0")
    due = (
        db.query(FeeInstallment)
        .filter(
            FeeInstallment.club_id == club_id,
            FeeInstallment.athlete_id == athlete_id,
            FeeInstallment.status.in_(("due", "partial", "overdue")),
        )
        .all()
    )
    remaining = Decimal("0")
    for inst in due:
        amt = Decimal(str(inst.amount or 0)) - Decimal(str(inst.amount_paid or 0))
        if amt > 0:
            remaining += amt
    months_approx = int(remaining / monthly) if monthly > 0 else 0
    title = f"Solde cotisations / رصيد الاشتراك — {athlete_name}"
    body = (
        f"Paiement {amount_paid} DZD enregistré. "
        f"Tarif mensuel {monthly} DZD · assurance réf. {insurance} DZD. "
        f"Reste à payer ≈ {remaining} DZD (~{months_approx} mois)."
    )
    return notify_parents_of_athlete(
        db,
        athlete_id,
        title,
        body,
        kind="payment_balance",
        club_id=club_id,
        link="/",
    )


def fanout_registration(
    db: Session,
    *,
    club_id: int,
    athlete_name: str,
    status: str = "created",
) -> int:
    title = f"Inscription / تسجيل — {athlete_name}"
    body = f"Statut : {status}"
    return notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value, Role.STAFF.value],
        title,
        body,
        kind="registration",
        club_id=club_id,
        link="/registrations",
    )


def fanout_inventory(
    db: Session,
    *,
    club_id: int,
    label: str,
    kind: str = "inventory",
) -> int:
    return notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value, Role.STAFF.value],
        f"Matériel / عتاد — {label}",
        label,
        kind=kind,
        club_id=club_id,
        link="/inventory",
    )


def fanout_parent_message_to_coaches(
    db: Session,
    *,
    club_id: int,
    parent_name: str,
    subject: str,
    team_id: int | None = None,
) -> int:
    title = f"Message parent / رسالة ولي — {parent_name}"
    body = subject
    n = notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value],
        title,
        body,
        kind="parent_message",
        club_id=club_id,
        link="/announcements",
    )
    if team_id:
        n += notify_team_coaches(
            db,
            team_id,
            title,
            body,
            kind="parent_message",
            club_id=club_id,
            link="/announcements",
        )
    return n


def fanout_coach_payroll_reminder(
    db: Session,
    *,
    club_id: int,
    coach_user_id: int,
    label: str,
    due_hint: str,
) -> dict[str, int]:
    title = f"Paiement coach / أجر المدرب — {label}"
    body = due_hint
    notify_user(db, coach_user_id, title, body, kind="coach_payroll", club_id=club_id, link="/finance")
    managers = notify_roles(
        db,
        [Role.ADMIN.value, Role.DIRECTION.value],
        title,
        body,
        kind="coach_payroll",
        club_id=club_id,
        link="/finance",
    )
    return {"coach": 1, "managers": managers}
