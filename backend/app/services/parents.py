from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.roles import Role
from app.core.security import hash_password
from app.models import ParentChild, User
from app.services.phone import default_parent_password, normalize_phone, phone_lookup_variants


def find_user_by_phone(db: Session, phone: str) -> User | None:
    for variant in phone_lookup_variants(phone):
        user = db.query(User).filter(User.phone == variant).first()
        if user:
            return user
    n = normalize_phone(phone)
    if n:
        return db.query(User).filter(User.phone == n).first()
    return None


def ensure_parent_account(
    db: Session,
    *,
    phone: str,
    full_name: str | None = None,
    athlete_id: int | None = None,
) -> tuple[User, str | None, bool]:
    """
    Crée ou réutilise un compte parent lié au téléphone.
    Retourne (user, temp_password_si_créé, created).
    """
    normalized = normalize_phone(phone)
    if not normalized:
        raise ValueError("Numéro de téléphone parent invalide")

    existing = find_user_by_phone(db, normalized)
    created = False
    temp_password: str | None = None
    if existing:
        parent = existing
        if parent.role != Role.PARENT and parent.role not in {Role.ADMIN, Role.DIRECTION, Role.STAFF}:
            parent.role = Role.PARENT
        if not parent.phone:
            parent.phone = normalized
    else:
        temp_password = default_parent_password(normalized)
        parent = User(
            phone=normalized,
            email=None,
            full_name=full_name or f"Parent {normalized}",
            role=Role.PARENT,
            password_hash=hash_password(temp_password),
            locale="ar",
        )
        db.add(parent)
        db.flush()
        created = True

    if athlete_id is not None:
        link = (
            db.query(ParentChild)
            .filter_by(parent_id=parent.id, athlete_id=athlete_id)
            .first()
        )
        if not link:
            db.add(ParentChild(parent_id=parent.id, athlete_id=athlete_id, relationship_label="parent"))

    return parent, temp_password, created
