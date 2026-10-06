"""Validation âge club et cohérence année de naissance ↔ catégorie."""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.models import Category, ClubSetting

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def age_years(birth: date, on: date | None = None) -> int:
    ref = on or date.today()
    years = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        years -= 1
    return years


def get_club_age_bounds(db: "Session | None" = None, club_id: int | None = None) -> tuple[int, int]:
    """Bornes âge : ClubSetting (par club) sinon config globale (défaut 5–17)."""
    settings = get_settings()
    lo, hi = int(settings.min_athlete_age), int(settings.max_athlete_age)
    if db is None or club_id is None:
        return lo, hi
    rows = (
        db.query(ClubSetting)
        .filter(
            ClubSetting.club_id == club_id,
            ClubSetting.key.in_(("min_athlete_age", "max_athlete_age")),
        )
        .all()
    )
    for row in rows:
        try:
            val = int(str(row.value).strip())
        except (TypeError, ValueError):
            continue
        if row.key == "min_athlete_age" and 0 <= val <= 100:
            lo = val
        elif row.key == "max_athlete_age" and 0 <= val <= 120:
            hi = val
    if lo > hi:
        lo, hi = hi, lo
    return lo, hi


def validate_club_age(
    birth: date | None,
    *,
    required: bool = False,
    db: "Session | None" = None,
    club_id: int | None = None,
) -> None:
    """Borne configurable par club (ClubSetting) sinon globale (défaut 5–17 ans)."""
    if birth is None:
        if required:
            raise ValueError("Date de naissance obligatoire.")
        return
    lo, hi = get_club_age_bounds(db, club_id)
    age = age_years(birth)
    if age < lo or age > hi:
        raise ValueError(
            f"Âge hors plage club ({lo}–{hi} ans). Né(e) {birth.isoformat()} → {age} ans."
        )


def validate_category_for_birth(birth: date | None, category: Category | None) -> None:
    """Si une catégorie est fournie, l'année de naissance doit être dans [min, max]."""
    if category is None:
        return
    if birth is None:
        raise ValueError(f"Date de naissance obligatoire pour la catégorie {category.code}.")
    year = birth.year
    if year < category.birth_year_min or year > category.birth_year_max:
        raise ValueError(
            f"Année {year} incompatible avec {category.code} "
            f"({category.birth_year_min}–{category.birth_year_max})."
        )


def pick_category_for_birth(categories: list[Category], birth: date) -> Category | None:
    year = birth.year
    for cat in categories:
        if cat.birth_year_min <= year <= cat.birth_year_max and cat.is_active:
            return cat
    return None
