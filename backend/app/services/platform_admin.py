"""Crée le compte plateforme superadmin s'il n'existe pas (C4)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.roles import Role
from app.core.security import hash_password
from app.models import User


def ensure_platform_superadmin(db: Session) -> None:
    email = (getattr(settings, "platform_admin_email", None) or "platform@nadi-connect.local").strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        if existing.role != Role.SUPERADMIN:
            existing.role = Role.SUPERADMIN
            existing.club_id = None
            db.commit()
        return
    pwd = getattr(settings, "platform_admin_password", None) or settings.default_admin_password
    user = User(
        email=email,
        full_name="Nadi Connect Platform",
        role=Role.SUPERADMIN,
        club_id=None,
        password_hash=hash_password(pwd),
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
