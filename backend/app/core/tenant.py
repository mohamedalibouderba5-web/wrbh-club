"""Résolution du tenant (club) — le club_id vient TOUJOURS du serveur (JWT/DB),
jamais du client. Règle DoD #1 (multi-club) et #7 (isolation)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.roles import Role
from app.models import Club, User

# Méthodes HTTP considérées comme écriture (bloquées si club suspendu)
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _load_club(db: Session, club_id: int) -> Club:
    club = db.get(Club, int(club_id))
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club introuvable")
    return club


def get_current_club_id(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """club_id du user courant + contrôle suspension (écritures bloquées)."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    club = _load_club(db, int(club_id))
    if club.status == "suspended" and request.method.upper() in _WRITE_METHODS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club suspendu — lecture seule (export autorisé)",
        )
    return int(club_id)


def get_current_club(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Club:
    """Même règle que get_current_club_id : lecture OK si suspendu, écriture 403."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    club = _load_club(db, int(club_id))
    if club.status == "suspended" and request.method.upper() in _WRITE_METHODS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club suspendu — lecture seule (export autorisé)",
        )
    return club


def is_superadmin(user: User) -> bool:
    return user.role == Role.SUPERADMIN


def assert_same_club(obj, club_id: int) -> None:
    """Vérifie qu'un objet appartient au club courant, sinon 404 (pas 403 pour ne pas
    divulguer l'existence de la ressource d'un autre club)."""
    obj_club = getattr(obj, "club_id", None)
    # Tolérance migration encore active — A3 la retirera après backfill NOT NULL
    if obj_club is not None and int(obj_club) != int(club_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ressource introuvable")
