"""Seed démo idempotent — clubs vitrine pour FormaTech (C1).

Usage:
  python -m scripts.seed_demo
  # ou dans le conteneur api :
  python -c "from scripts.seed_demo import run; run()"

Ne touche PAS au club wrbh (données réelles). Crée / complète :
  - demo-foot-safex (football)
  - demo-multi-safex (judo + natation)
  - demo-hand-safex (handball)
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Athlete, Category, Club, Discipline, Registration, Season, User
from app.services.sports import default_age_bands, normalize_sport, sport_code_short


DEMO_PASSWORD = "DemoClub!2026"

CLUBS = [
    {
        "slug": "demo-foot-safex",
        "name": "Espoir Football Alger",
        "name_ar": "أمل كرة القدم الجزائر",
        "acronym": "EFA",
        "sport": "football",
        "sports": ["football"],
        "n_athletes": 40,
    },
    {
        "slug": "demo-multi-safex",
        "name": "Club Multisport Hydra",
        "name_ar": "نادي متعدد الرياضات حيدرة",
        "acronym": "CMH",
        "sport": "judo",
        "sports": ["judo", "natation", "karate"],
        "n_athletes": 30,
    },
    {
        "slug": "demo-hand-safex",
        "name": "École Handball Bab Ezzouar",
        "name_ar": "مدرسة كرة اليد باب الزوار",
        "acronym": "EHBE",
        "sport": "handball",
        "sports": ["handball"],
        "n_athletes": 20,
    },
]

FIRST = [
    "Amine", "Yacine", "Rania", "Ines", "Mohamed", "Sara", "Bilal", "Nour",
    "Karim", "Lina", "Sofiane", "Amina", "Mehdi", "Yasmine", "Omar", "Salma",
]
LAST = [
    "Benali", "Khelifi", "Mansouri", "Bouzid", "Haddad", "Cherif", "Saadi",
    "Touati", "Ziani", "Brahimi", "Messaoudi", "Amrani", "Belkacem", "Dahmani",
]


def _ensure_club(db, spec: dict) -> Club:
    club = db.query(Club).filter(Club.slug == spec["slug"]).first()
    if club:
        club.is_platform = True
        club.status = "active"
        club.plan = "club"
        return club
    club = Club(
        slug=spec["slug"],
        name=spec["name"],
        name_ar=spec["name_ar"],
        acronym=spec["acronym"],
        sport=spec["sport"],
        status="active",
        plan="club",
        is_platform=True,
        primary_color="#1E3A8A",
        accent_color="#F5C518",
        app_name=spec["name"],
    )
    db.add(club)
    db.flush()
    admin = User(
        club_id=club.id,
        email=f"admin@{spec['slug']}.test",
        full_name=f"Admin {spec['acronym']}",
        role="admin",
        password_hash=hash_password(DEMO_PASSWORD),
        must_change_password=False,
        is_active=True,
    )
    db.add(admin)
    season = Season(
        club_id=club.id,
        name="2026/2027",
        starts_on=date(2026, 8, 1),
        ends_on=date(2027, 7, 31),
        is_current=True,
        registration_open=True,
    )
    db.add(season)
    db.flush()
    for sport in spec["sports"]:
        code = sport_code_short(normalize_sport(sport))
        disc = Discipline(club_id=club.id, name=sport.title(), code=code)
        db.add(disc)
        db.flush()
        for band in default_age_bands(sport):
            suffix, name_fr, _name_ar, ymin, ymax = band
            db.add(
                Category(
                    club_id=club.id,
                    season_id=season.id,
                    discipline_id=disc.id,
                    code=f"{code}-{suffix}",
                    name=f"{sport.title()} {name_fr}",
                    birth_year_min=ymin,
                    birth_year_max=ymax,
                )
            )
    db.flush()
    return club


def _fill_athletes(db, club: Club, n: int) -> None:
    season = (
        db.query(Season)
        .filter(Season.club_id == club.id, Season.is_current.is_(True))
        .first()
    )
    cats = db.query(Category).filter(Category.club_id == club.id).all()
    if not season or not cats:
        return
    existing = db.query(Athlete).filter(Athlete.club_id == club.id).count()
    if existing >= n:
        return
    need = n - existing
    for i in range(need):
        cat = cats[i % len(cats)]
        y = (cat.birth_year_min + cat.birth_year_max) // 2
        name = f"{FIRST[i % len(FIRST)]} {LAST[i % len(LAST)]}"
        ath = Athlete(
            club_id=club.id,
            full_name=name,
            birth_date=date(y, (i % 12) + 1, (i % 27) + 1),
            status="Active",
            license_number=f"LIC-{club.acronym}-{1000 + i}",
            license_valid_until=date.today() + timedelta(days=60 + (i % 200)),
            medical_cert_date=date.today() - timedelta(days=30),
            medical_cert_valid_until=date.today() + timedelta(days=20 + (i % 90)),
        )
        db.add(ath)
        db.flush()
        db.add(
            Registration(
                club_id=club.id,
                athlete_id=ath.id,
                season_id=season.id,
                category_id=cat.id,
                registered_on=date.today() - timedelta(days=i % 40),
                status="approved",
                source="seed",
                subscription_fee=Decimal("4000"),
            )
        )


def run() -> None:
    db = SessionLocal()
    try:
        for spec in CLUBS:
            club = _ensure_club(db, spec)
            _fill_athletes(db, club, int(spec["n_athletes"]))
        db.commit()
        print("SEED_DEMO_OK", [c["slug"] for c in CLUBS])
    finally:
        db.close()


if __name__ == "__main__":
    run()
