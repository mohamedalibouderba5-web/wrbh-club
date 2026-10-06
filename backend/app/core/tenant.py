"""Résolution du tenant (club) — le club_id vient TOUJOURS du serveur (JWT/DB),
jamais du client. Règle DoD #1 (multi-club) et #7 (isolation)."""
from __future__ import annotations

from datetime import date

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.roles import Role
from app.models import Club, User

# Méthodes HTTP considérées comme écriture (bloquées si club suspendu / essai expiré)
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _load_club(db: Session, club_id: int) -> Club:
    club = db.get(Club, int(club_id))
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club introuvable")
    return club


def _trial_expired(club: Club) -> bool:
    """Discovery : essai terminé → écritures bloquées (C5)."""
    if (club.plan or "").lower() != "discovery":
        return False
    ends = getattr(club, "trial_ends_on", None)
    if not ends:
        return False
    return date.today() > ends


def _assert_writable(club: Club, method: str) -> None:
    if method.upper() not in _WRITE_METHODS:
        return
    if club.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club suspendu — lecture seule (export autorisé)",
        )
    if _trial_expired(club):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Essai terminé — passez à un abonnement pour continuer (lecture seule)",
        )


def get_current_club_id(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """club_id du user courant + contrôle suspension / essai (écritures bloquées)."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    club = _load_club(db, int(club_id))
    _assert_writable(club, request.method)
    return int(club_id)


def get_current_club(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Club:
    """Lecture OK si suspendu/essai expiré ; écriture 403."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur non rattaché à un club",
        )
    club = _load_club(db, int(club_id))
    _assert_writable(club, request.method)
    return club


def is_superadmin(user: User) -> bool:
    return user.role == Role.SUPERADMIN


def assert_same_club(obj, club_id: int) -> None:
    """Vérifie qu'un objet appartient au club courant, sinon 404 (pas 403 pour ne pas
    divulguer l'existence de la ressource d'un autre club)."""
    obj_club = getattr(obj, "club_id", None)
    # A3 : plus de tolérance NULL — une ligne sans club est invisible / refusée
    if obj_club is None or int(obj_club) != int(club_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ressource introuvable")


def club_trial_meta(club: Club) -> dict:
    """Métadonnées essai pour bootstrap / UI."""
    ends = getattr(club, "trial_ends_on", None)
    expired = _trial_expired(club)
    days_left = None
    if ends and (club.plan or "").lower() == "discovery":
        days_left = (ends - date.today()).days
    return {
        "trial_ends_on": ends.isoformat() if ends else None,
        "trial_days_left": days_left,
        "trial_expired": expired,
        "status": club.status,
        "plan": club.plan,
        "name": club.name,
        "slug": club.slug,
    }
