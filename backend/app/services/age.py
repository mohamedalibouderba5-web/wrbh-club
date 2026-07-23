"""Validation âge club et cohérence année de naissance ↔ catégorie."""
from __future__ import annotations

from datetime import date

from app.core.config import get_settings
from app.models import Category


def age_years(birth: date, on: date | None = None) -> int:
    ref = on or date.today()
    years = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        years -= 1
    return years


def validate_club_age(birth: date | None, *, required: bool = False) -> None:
    """Borne globale configurable (défaut 5–17 ans)."""
    if birth is None:
        if required:
            raise ValueError("Date de naissance obligatoire.")
        return
    settings = get_settings()
    age = age_years(birth)
    lo, hi = settings.min_athlete_age, settings.max_athlete_age
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
