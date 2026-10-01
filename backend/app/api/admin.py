"""Console plateforme — lecture + suspension (C4 / A9)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.roles import Role
from app.models import Athlete, Club, User

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_superadmin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé super-admin")
    return user


def _club_row(c: Club, athletes_count: int) -> dict:
    ends = getattr(c, "trial_ends_on", None)
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "name_ar": getattr(c, "name_ar", None),
        "plan": c.plan,
        "status": c.status,
        "sport": getattr(c, "sport", None),
        "is_platform": bool(getattr(c, "is_platform", False)),
        "trial_ends_on": ends.isoformat() if ends else None,
        "athletes_count": int(athletes_count or 0),
        "created_at": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
    }


@router.get("/clubs")
def list_clubs_readonly(
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Liste lecture seule : clubs + plan + essai + compteurs athlètes."""
    athlete_counts = dict(
        db.query(Athlete.club_id, func.count(Athlete.id))
        .filter(Athlete.club_id.isnot(None))
        .group_by(Athlete.club_id)
        .all()
    )
    clubs = db.query(Club).order_by(Club.name.asc()).all()
    return [_club_row(c, athlete_counts.get(c.id, 0)) for c in clubs]


class ClubPatchIn(BaseModel):
    status: str | None = Field(None, description="active | suspended")
    plan: str | None = None
    is_platform: bool | None = None


@router.patch("/clubs/{club_id}")
def patch_club(
    club_id: int,
    body: ClubPatchIn,
    _: User = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Suspendre / réactiver un club (A9) — ops plateforme."""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club introuvable")
    if body.status is not None:
        st = body.status.strip().lower()
        if st not in ("active", "suspended"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="status doit être active ou suspended",
            )
        club.status = st
    if body.plan is not None:
        club.plan = body.plan.strip() or club.plan
    if body.is_platform is not None:
        club.is_platform = bool(body.is_platform)
    db.commit()
    db.refresh(club)
    n = (
        db.query(func.count(Athlete.id))
        .filter(Athlete.club_id == club.id)
        .scalar()
        or 0
    )
    return _club_row(club, n)
