"""Console plateforme — lecture seule (C4)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
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
    out = []
    for c in clubs:
        ends = getattr(c, "trial_ends_on", None)
        out.append(
            {
                "id": c.id,
                "slug": c.slug,
                "name": c.name,
                "name_ar": getattr(c, "name_ar", None),
                "plan": c.plan,
                "status": c.status,
                "sport": getattr(c, "sport", None),
                "is_platform": bool(getattr(c, "is_platform", False)),
                "trial_ends_on": ends.isoformat() if ends else None,
                "athletes_count": int(athlete_counts.get(c.id, 0) or 0),
                "created_at": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
            }
        )
    return out
