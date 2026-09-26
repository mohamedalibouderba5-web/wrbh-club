"""Exports Excel (joueurs, équipements, paiements)."""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.core.tenant import get_current_club_id
from app.models import (
    Athlete,
    Category,
    FeeInstallment,
    ParentChild,
    Payment,
    Registration,
    Season,
    Team,
    User,
)

router = APIRouter(prefix="/exports", tags=["exports"])


def _xlsx_response(wb: Workbook, filename: str) -> StreamingResponse:
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _style_header(ws, cols: list[str]) -> None:
    ws.append(cols)
    for cell in ws[1]:
        cell.font = Font(bold=True)


def _season(db: Session, club_id: int, season_id: Optional[int]) -> Season | None:
    if season_id:
        s = db.get(Season, season_id)
        if not s:
            raise HTTPException(404, "Saison introuvable")
        return s
    return (
        db.query(Season)
        .filter(or_(Season.club_id == club_id, Season.club_id.is_(None)), Season.is_current.is_(True))
        .first()
    )


def _parent_phone(db: Session, athlete_id: int) -> str:
    link = db.query(ParentChild).filter(ParentChild.athlete_id == athlete_id).first()
    if not link:
        return ""
    u = db.get(User, link.parent_id)
    return (u.phone or u.email or "") if u else ""


@router.get("/templates")
def list_export_templates(
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
):
    return [
        {
            "id": "full",
            "label_fr": "Base complète (tous les joueurs inscrits)",
            "label_ar": "قاعدة كاملة (كل اللاعبين المسجلين)",
            "description": "Nom, catégorie, taille, maillot, sac, parent, paiements…",
        },
        {
            "id": "equipment",
            "label_fr": "Bon de commande équipements / maillots",
            "label_ar": "طلب تجهيزات / قمصان",
            "description": "Nom, catégorie, taille, n° kit, maillot, cartable — pour commandes",
        },
        {
            "id": "payments",
            "label_fr": "État des paiements / cotisations",
            "label_ar": "حالة المدفوعات / الاشتراكات",
            "description": "Athlète, dû, payé, reste, statut — filtrable par saison",
        },
    ]


@router.get("/workbook")
def export_workbook(
    template: str = Query("full", pattern="^(full|equipment|payments)$"),
    season_id: Optional[int] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = Query(None, description="registration status filter"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    season = _season(db, club_id, season_id)
    if not season:
        raise HTTPException(400, "Aucune saison")

    q = (
        db.query(Registration, Athlete, Category, Team)
        .join(Athlete, Athlete.id == Registration.athlete_id)
        .outerjoin(Category, Category.id == Registration.category_id)
        .outerjoin(Team, Team.id == Registration.team_id)
        .filter(
            Registration.season_id == season.id,
            or_(Registration.club_id == club_id, Registration.club_id.is_(None)),
            Registration.status != "archived",
        )
    )
    if category_id:
        q = q.filter(Registration.category_id == category_id)
    if status:
        q = q.filter(Registration.status == status)
    rows = q.order_by(Category.code.nulls_last(), Athlete.full_name).all()

    wb = Workbook()
    ws = wb.active
    today = date.today().isoformat()

    if template == "equipment":
        ws.title = "Commande équipements"
        _style_header(
            ws,
            [
                "N° liste",
                "Nom",
                "Catégorie",
                "Équipe",
                "Année naissance",
                "Taille",
                "N° kit",
                "Maillot",
                "Cartable",
                "Tél. parent",
            ],
        )
        for reg, ath, cat, team in rows:
            ws.append(
                [
                    reg.list_number,
                    ath.full_name,
                    cat.code if cat else "",
                    team.name if team else "",
                    ath.birth_date.year if ath.birth_date else "",
                    reg.kit_size or "",
                    reg.kit_number,
                    "Oui" if reg.has_jersey else "Non",
                    "Oui" if reg.has_backpack else "Non",
                    _parent_phone(db, ath.id),
                ]
            )
        fname = f"wrbh-equipements-{season.name.replace('/', '-')}-{today}.xlsx"

    elif template == "payments":
        ws.title = "Paiements"
        _style_header(
            ws,
            [
                "Nom",
                "Catégorie",
                "Statut inscription",
                "Total dû (DZD)",
                "Total payé (DZD)",
                "Reste (DZD)",
                "Dernier paiement",
                "Tél. parent",
            ],
        )
        for reg, ath, cat, team in rows:
            due = (
                db.query(FeeInstallment)
                .filter(
                    FeeInstallment.athlete_id == ath.id,
                    FeeInstallment.season_id == season.id,
                )
                .all()
            )
            total_due = sum(float(i.amount or 0) for i in due)
            total_paid_inst = sum(float(i.amount_paid or 0) for i in due)
            pays = (
                db.query(Payment)
                .filter(Payment.athlete_id == ath.id)
                .order_by(Payment.paid_on.desc().nullslast())
                .limit(1)
                .all()
            )
            paid_sum = (
                db.query(Payment)
                .filter(Payment.athlete_id == ath.id)
                .all()
            )
            total_paid = sum(float(p.amount or 0) for p in paid_sum) or total_paid_inst
            last = pays[0].paid_on.isoformat() if pays and pays[0].paid_on else ""
            reste = max(total_due - total_paid, 0)
            ws.append(
                [
                    ath.full_name,
                    cat.code if cat else "",
                    reg.status,
                    round(total_due, 2),
                    round(total_paid, 2),
                    round(reste, 2),
                    last,
                    _parent_phone(db, ath.id),
                ]
            )
        fname = f"wrbh-paiements-{season.name.replace('/', '-')}-{today}.xlsx"

    else:
        ws.title = "Base joueurs"
        _style_header(
            ws,
            [
                "Référence",
                "N° liste",
                "Nom",
                "Date naissance",
                "Lieu naissance",
                "Groupe sanguin",
                "Catégorie",
                "Équipe",
                "Statut",
                "Taille équipement",
                "N° kit",
                "Maillot remis",
                "Cartable remis",
                "Tél. parent",
                "Cotisation inscription",
                "Date inscription",
            ],
        )
        for reg, ath, cat, team in rows:
            ws.append(
                [
                    reg.reference or "",
                    reg.list_number,
                    ath.full_name,
                    ath.birth_date.isoformat() if ath.birth_date else "",
                    ath.birth_place or "",
                    ath.blood_type or "",
                    cat.code if cat else "",
                    team.name if team else "",
                    reg.status,
                    reg.kit_size or "",
                    reg.kit_number,
                    "Oui" if reg.has_jersey else "Non",
                    "Oui" if reg.has_backpack else "Non",
                    _parent_phone(db, ath.id),
                    float(reg.subscription_fee or 0),
                    reg.registered_on.isoformat() if reg.registered_on else "",
                ]
            )
        fname = f"wrbh-base-complete-{season.name.replace('/', '-')}-{today}.xlsx"

    return _xlsx_response(wb, fname)
