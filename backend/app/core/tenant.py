"""Résolution du tenant (club) — le club_id vient TOUJOURS du serveur (JWT/DB),
jamais du client. Règle DoD #1 (multi-club) et #7 (isolation)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.roles import Role
from app.models import Club, User


def get_current_club_id(user: User = Depends(get_current_user)) -> int:
    """club_id du user courant. Le super-admin n'est pas rattaché à un club."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    return int(club_id)


def get_current_club(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Club:
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    club = db.get(Club, int(club_id))
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club introuvable")
    if club.status == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Club suspendu")
    return club


def is_superadmin(user: User) -> bool:
    return user.role == Role.SUPERADMIN


def assert_same_club(obj, club_id: int) -> None:
    """Vérifie qu'un objet appartient au club courant, sinon 404 (pas 403 pour ne pas
    divulguer l'existence de la ressource d'un autre club)."""
    obj_club = getattr(obj, "club_id", None)
    # Tolérance pendant la migration : les anciennes lignes non backfillées (NULL) restent visibles
    if obj_club is not None and int(obj_club) != int(club_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ressource introuvable")
