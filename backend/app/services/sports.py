"""Sports / disciplines — marché Algérie (clubs mono ou multisport)."""
from __future__ import annotations

from datetime import datetime, timezone

SPORT_LABELS: dict[str, str] = {
    "football": "Football",
    "handball": "Handball",
    "judo": "Judo",
    "karate": "Karaté",
    "athletics": "Athlétisme",
    "volleyball": "Volleyball",
    "basketball": "Basketball",
    "boxing": "Boxe",
    "swimming": "Natation",
}

SPORT_LABELS_AR: dict[str, str] = {
    "football": "كرة القدم",
    "handball": "كرة اليد",
    "judo": "جودو",
    "karate": "كاراتيه",
    "athletics": "ألعاب القوى",
    "volleyball": "كرة الطائرة",
    "basketball": "كرة السلة",
    "boxing": "ملاكمة",
    "swimming": "سباحة",
}


def normalize_sport(code: str | None) -> str:
    c = (code or "football").strip().lower()
    return c if c in SPORT_LABELS else "football"


def sport_code_short(sport: str) -> str:
    """Préfixe court pour codes catégories (FOOT-U11, JUDO-U11…)."""
    mapping = {
        "football": "FOOT",
        "handball": "HAND",
        "judo": "JUDO",
        "karate": "KARA",
        "athletics": "ATHL",
        "volleyball": "VOLL",
        "basketball": "BASK",
        "boxing": "BOXE",
        "swimming": "NATA",
    }
    return mapping.get(normalize_sport(sport), normalize_sport(sport)[:4].upper())


def default_age_bands(sport: str) -> list[tuple[str, str, str, int, int]]:
    """(suffixe_code, name_fr, name_ar, birth_year_min, birth_year_max)."""
    year = datetime.now(timezone.utc).year
    sport = normalize_sport(sport)
    bands = [
        ("U7", "U7", "أقل من 7", year - 7, year - 5),
        ("U9", "U9", "أقل من 9", year - 9, year - 7),
        ("U11", "U11", "أقل من 11", year - 11, year - 9),
        ("U13", "U13", "أقل من 13", year - 13, year - 11),
        ("U15", "U15", "أقل من 15", year - 15, year - 13),
        ("U17", "U17", "أقل من 17", year - 17, year - 15),
    ]
    if sport in {"judo", "karate", "boxing", "athletics", "swimming"}:
        bands.append(("SEN", "Seniors", "كبار", year - 60, year - 17))
    return bands


def category_code_for(sport: str, band_suffix: str) -> str:
    return f"{sport_code_short(sport)}-{band_suffix}"
