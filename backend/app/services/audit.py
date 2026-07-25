"""Journal d'audit — traçabilité create/update/delete (conformité / commercialisation)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AuditLog


def write_audit(
    db: Session,
    *,
    action: str,
    entity: str,
    entity_id: int | None = None,
    user_id: int | None = None,
    detail: str | None = None,
    commit: bool = False,
) -> AuditLog:
    row = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=(detail or "")[:2000] if detail else None,
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    return row
