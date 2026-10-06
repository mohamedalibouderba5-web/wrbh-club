"""Chargement de ressources borné au club courant (audit Codex Lot 1)."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session


def get_scoped(db: Session, model, resource_id: int | None, club_id: int):
    """Charge `model.id == resource_id` **et** `club_id`, sinon 404 opaque."""
    if resource_id is None:
        raise HTTPException(404, "Ressource introuvable")
    row = (
        db.query(model)
        .filter(model.id == resource_id, model.club_id == club_id)
        .first()
    )
    if row is None:
        raise HTTPException(404, "Ressource introuvable")
    return row


def get_scoped_optional(db: Session, model, resource_id: int | None, club_id: int):
    """Comme get_scoped, mais `None` si resource_id est None."""
    if resource_id is None:
        return None
    return get_scoped(db, model, resource_id, club_id)
