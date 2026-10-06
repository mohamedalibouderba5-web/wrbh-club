from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.roles import Role
from app.core.security import hash_password
from app.models import ParentChild, User
from app.services.phone import generate_parent_password, normalize_phone, phone_lookup_variants


def find_user_by_phone(db: Session, phone: str, club_id: int | None = None) -> User | None:
    variants = [v for v in phone_lookup_variants(phone) if v]
    n = normalize_phone(phone)
    if n and n not in variants:
        variants.append(n)
    if not variants:
        return None
    q = db.query(User).filter(User.phone.in_(variants))
    if club_id is not None:
        q = q.filter(User.club_id == club_id)
    return q.first()


def ensure_parent_account(
    db: Session,
    *,
    phone: str,
    full_name: str | None = None,
    athlete_id: int | None = None,
    club_id: int | None = None,
) -> tuple[User, str | None, bool]:
    """
    Crée ou réutilise un compte parent lié au téléphone.
    Retourne (user, temp_password_si_créé, created).
    """
    normalized = normalize_phone(phone)
    if not normalized:
        raise ValueError("Numéro de téléphone parent invalide")

    existing = find_user_by_phone(db, normalized, club_id=club_id)
    created = False
    temp_password: str | None = None
    if not existing:
        # Téléphone unique global : réutiliser si même club, sinon message clair
        any_phone = find_user_by_phone(db, normalized, club_id=None)
        if any_phone is not None:
            other = getattr(any_phone, "club_id", None)
            if club_id is not None and other is not None and int(other) != int(club_id):
                raise ValueError(
                    "Ce téléphone parent est déjà utilisé dans un autre club — "
                    "choisissez un autre numéro ou connectez le parent à ce club via la plateforme"
                )
            existing = any_phone
    if existing:
        parent = existing
        if parent.role != Role.PARENT and parent.role not in {Role.ADMIN, Role.DIRECTION, Role.STAFF}:
            parent.role = Role.PARENT
        if not parent.phone:
            parent.phone = normalized
        if club_id and not getattr(parent, "club_id", None):
            parent.club_id = club_id
    else:
        temp_password = generate_parent_password()
        parent = User(
            club_id=club_id,
            phone=normalized,
            email=None,
            full_name=full_name or f"Parent {normalized}",
            role=Role.PARENT,
            password_hash=hash_password(temp_password),
            locale="ar",
            must_change_password=True,
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
            db.add(
                ParentChild(
                    parent_id=parent.id,
                    athlete_id=athlete_id,
                    relationship_label="parent",
                    club_id=club_id,
                )
            )

    return parent, temp_password, created
