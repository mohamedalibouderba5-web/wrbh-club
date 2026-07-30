from datetime import date
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session, load_only

from app.api.deps import get_current_user, require_roles
from app.core.tenant import assert_same_club, get_current_club_id
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import hash_password
from app.models import (
    Announcement,
    Athlete,
    Attendance,
    AuditLog,
    Category,
    Convocation,
    Discipline,
    EmergencyContact,
    Event,
    FeeInstallment,
    Notification,
    ParentChild,
    Payment,
    Registration,
    Season,
    Team,
    TeamCoach,
    TeamMembership,
    User,
)
from app.schemas import (
    AthleteCreate,
    AthleteOut,
    AthleteUpdate,
    CategoryOut,
    RegistrationCreate,
    RegistrationOut,
    SeasonOut,
    TeamCoachAssignIn,
    TeamCoachOut,
    TeamOut,
    TeamWithCoachesOut,
)
from app.services.age import validate_category_for_birth, validate_club_age
from app.services.blood import validate_blood_type
from app.services.fast_cache import cache_delete_prefix, cache_get, cache_set
from app.services.audit import write_audit
from app.services.fees import ensure_season_fee_bundle, ensure_subscription_installment
from app.services.notify import notify_parents_of_athlete, notify_role
from app.services.parents import ensure_parent_account
from app.services.phone import normalize_phone, validate_dz_mobile
from app.services.media import enrich_media_path

TEST_MARKER = "TEST-WRBH-BATCH"
settings = get_settings()

router = APIRouter(tags=["structure"])

# Cache stats par club : {club_id: {"ts": float, "payload": dict}}
_STATS_CACHE: dict = {}
_STATS_TTL_SEC = 45.0


def _bust_club_caches() -> None:
    cache_delete_prefix("athletes:")
    cache_delete_prefix("regs:")
    cache_delete_prefix("bootstrap:")
    cache_delete_prefix("categories:")
    cache_delete_prefix("seasons:")
    cache_delete_prefix("finance:")
    _STATS_CACHE.clear()


@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    club_id = getattr(user, "club_id", None)
    key = f"seasons:{club_id}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    q = db.query(Season)
    if club_id:
        q = q.filter(or_(Season.club_id == club_id, Season.club_id.is_(None)))
    rows = q.order_by(Season.starts_on.desc()).all()
    out = [SeasonOut.model_validate(s) for s in rows]
    cache_set(key, out, 120)
    return out


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    season_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    club_id = getattr(user, "club_id", None)
    key = f"categories:{club_id}:{season_id or 'current'}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    q = db.query(Category)
    if club_id:
        q = q.filter(or_(Category.club_id == club_id, Category.club_id.is_(None)))
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        if current:
            q = q.filter(Category.season_id == current.id)
    rows = q.order_by(Category.birth_year_min).all()
    out = [CategoryOut.model_validate(c) for c in rows]
    cache_set(key, out, 120)
    return out


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Un seul appel : saisons + catégories + stats + finance (si staff) + compte événements."""
    key = f"bootstrap:{user.role}:{user.id}"
    cached = cache_get(key)
    if cached is not None:
        return cached

    seasons = list_seasons(db, user)
    categories = list_categories(None, db, user)
    stats = club_stats(db, user)
    club_id = getattr(user, "club_id", None)
    events_q = db.query(func.count(Event.id)).filter(Event.is_cancelled.is_(False))
    if club_id:
        events_q = events_q.filter(or_(Event.club_id == club_id, Event.club_id.is_(None)))
    events_count = events_q.scalar() or 0
    finance = None
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF} and club_id:
        from app.api.finance import finance_dashboard

        try:
            finance = finance_dashboard(db, user, club_id)
        except Exception:
            finance = None

    payload = {
        "seasons": [s.model_dump() if hasattr(s, "model_dump") else s for s in seasons],
        "categories": [c.model_dump() if hasattr(c, "model_dump") else c for c in categories],
        "stats": stats,
        "events_count": int(events_count),
        "finance": finance,
    }
    cache_set(key, payload, 25)
    return payload


@router.get("/teams", response_model=list[TeamOut])
def list_teams(
    category_id: int | None = None,
    season_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    """Par défaut : équipes de la saison courante uniquement (évite les doublons inter-saisons)."""
    q = db.query(Team).filter(or_(Team.club_id == club_id, Team.club_id.is_(None)))
    if category_id:
        q = q.filter(Team.category_id == category_id)
    else:
        sid = season_id
        if not sid:
            cur = db.query(Season).filter(Season.is_current.is_(True)).first()
            sid = cur.id if cur else None
        if sid:
            cat_ids = [c.id for c in db.query(Category.id).filter(Category.season_id == sid)]
            if cat_ids:
                q = q.filter(Team.category_id.in_(cat_ids))
    return q.order_by(Team.name).all()


def _team_coach_rows(db: Session, team_id: int) -> list[TeamCoachOut]:
    rows = db.query(TeamCoach).filter(TeamCoach.team_id == team_id).all()
    user_ids = [r.user_id for r in rows]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    out: list[TeamCoachOut] = []
    for r in rows:
        u = users.get(r.user_id)
        out.append(
            TeamCoachOut(
                id=r.id,
                team_id=r.team_id,
                user_id=r.user_id,
                role_label=r.role_label,
                coach_name=u.full_name if u else None,
                coach_phone=u.phone if u else None,
            )
        )
    # Titulaire d'abord
    out.sort(key=lambda c: (0 if c.role_label == "primary" else 1, c.coach_name or ""))
    return out


@router.get("/teams/coaches", response_model=list[TeamWithCoachesOut])
def list_teams_with_coaches(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    """Vue équipes + coachs (saison courante)."""
    cur = db.query(Season).filter(Season.is_current.is_(True)).first()
    q = db.query(Team).filter(or_(Team.club_id == club_id, Team.club_id.is_(None)))
    cats: dict[int, Category] = {}
    if cur:
        cat_rows = db.query(Category).filter(Category.season_id == cur.id).all()
        cats = {c.id: c for c in cat_rows}
        if cats:
            q = q.filter(Team.category_id.in_(list(cats.keys())))
    teams = q.order_by(Team.name).all()
    return [
        TeamWithCoachesOut(
            id=t.id,
            category_id=t.category_id,
            name=t.name,
            name_ar=t.name_ar,
            code=t.code,
            category_code=cats[t.category_id].code if t.category_id in cats else None,
            coaches=_team_coach_rows(db, t.id),
        )
        for t in teams
    ]


@router.get("/teams/{team_id}/coaches", response_model=list[TeamCoachOut])
def list_team_coaches(
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Équipe introuvable")
    assert_same_club(team, club_id)
    return _team_coach_rows(db, team_id)


@router.put("/teams/{team_id}/coaches", response_model=list[TeamCoachOut])
def assign_team_coaches(
    team_id: int,
    payload: TeamCoachAssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Remplace les coachs d'une équipe (un coach peut être sur plusieurs équipes)."""
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Équipe introuvable")
    assert_same_club(team, club_id)
    seen: set[int] = set()
    cleaned: list[tuple[int, str]] = []
    for item in payload.coaches:
        if item.user_id in seen:
            continue
        coach = db.get(User, item.user_id)
        if not coach or coach.role != Role.COACH:
            raise HTTPException(400, f"Utilisateur {item.user_id} n'est pas un coach")
        if getattr(coach, "club_id", None) not in (None, club_id):
            raise HTTPException(400, f"Coach {item.user_id} hors de ce club")
        label = "primary" if item.is_primary or item.role_label == "primary" else (item.role_label or "coach")
        if label not in {"primary", "coach", "assistant"}:
            label = "coach"
        cleaned.append((item.user_id, label))
        seen.add(item.user_id)
    # Un seul titulaire
    primaries = [i for i, (_, lab) in enumerate(cleaned) if lab == "primary"]
    if len(primaries) > 1:
        for i in primaries[1:]:
            cleaned[i] = (cleaned[i][0], "coach")
    elif cleaned and not primaries:
        cleaned[0] = (cleaned[0][0], "primary")

    db.query(TeamCoach).filter(TeamCoach.team_id == team_id).delete(synchronize_session=False)
    for uid, lab in cleaned:
        db.add(TeamCoach(club_id=club_id, team_id=team_id, user_id=uid, role_label=lab))

    # Rendre l'agenda coach cohérent : rattacher le titulaire aux séances sans coach_id
    primary_uid = next((uid for uid, lab in cleaned if lab == "primary"), cleaned[0][0] if cleaned else None)
    if primary_uid:
        (
            db.query(Event)
            .filter(
                Event.team_id == team_id,
                or_(Event.coach_id.is_(None), Event.coach_id == 0),
            )
            .update({Event.coach_id: primary_uid}, synchronize_session=False)
        )

    db.commit()
    write_audit(
        db,
        action="team_coaches_assign",
        entity="team",
        entity_id=team_id,
        user_id=user.id,
        detail=",".join(f"{u}:{l}" for u, l in cleaned),
        commit=True,
    )
    return _team_coach_rows(db, team_id)


@router.post("/teams/backfill-event-coaches")
def backfill_event_coaches(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Remplit Event.coach_id depuis TeamCoach (titulaire) pour les séances orphelines.

    Corrige l'agenda coach vide quand les séances existent mais sans coach lié.
    """
    links = (
        db.query(TeamCoach)
        .filter(or_(TeamCoach.club_id == club_id, TeamCoach.club_id.is_(None)))
        .all()
    )
    primary_by_team: dict[int, int] = {}
    for row in links:
        if row.role_label == "primary" or row.team_id not in primary_by_team:
            if row.role_label == "primary":
                primary_by_team[row.team_id] = row.user_id
            elif row.team_id not in primary_by_team:
                primary_by_team[row.team_id] = row.user_id
    # Prefer explicit primary
    for row in links:
        if row.role_label == "primary":
            primary_by_team[row.team_id] = row.user_id

    updated = 0
    for team_id, coach_id in primary_by_team.items():
        n = (
            db.query(Event)
            .filter(
                Event.team_id == team_id,
                or_(Event.club_id == club_id, Event.club_id.is_(None)),
                Event.coach_id.is_(None),
            )
            .update({Event.coach_id: coach_id}, synchronize_session=False)
        )
        updated += int(n or 0)

    write_audit(
        db,
        action="backfill",
        entity="event_coaches",
        user_id=user.id,
        club_id=club_id,
        detail=f"updated={updated} teams={len(primary_by_team)}",
        commit=False,
    )
    db.commit()
    return {"events_updated": updated, "teams_with_coach": len(primary_by_team)}


@router.get("/coaches", response_model=list)
def list_coaches(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    """Liste des utilisateurs rôle coach (pour sélection agenda / équipes)."""
    q = db.query(User).filter(
        User.role == Role.COACH,
        or_(User.club_id == club_id, User.club_id.is_(None)),
    )
    if not include_inactive:
        q = q.filter(User.is_active.is_(True))
    rows = q.order_by(User.full_name).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "full_name_ar": u.full_name_ar,
            "phone": u.phone,
            "email": u.email,
            "is_active": u.is_active,
        }
        for u in rows
    ]


# Structure saison 2026/2027 demandée par le gérant du club (ABDO H)
# Chaque coach a une équipe / groupe (G1, G2…).
_SEASON_TEAM_STRUCTURE = [
    ("U14", "U14", "تحت 14", 2012, 2013, [("U14G1", "U14 Groupe 1", "U14 مجموعة 1"), ("U14G2", "U14 Groupe 2", "U14 مجموعة 2")]),
    ("U13", "U13", "تحت 13", 2014, 2015, [("U13G1", "U13 Groupe 1", "U13 مجموعة 1"), ("U13G2", "U13 Groupe 2", "U13 مجموعة 2")]),
    ("U11", "U11", "تحت 11", 2016, 2017, [("U11G1", "U11 Groupe 1", "U11 مجموعة 1"), ("U11G2", "U11 Groupe 2", "U11 مجموعة 2")]),
    ("U9", "U9", "تحت 9", 2018, 2019, [("U9G1", "U9 Groupe 1", "U9 مجموعة 1"), ("U9G2", "U9 Groupe 2", "U9 مجموعة 2")]),
    ("U7", "U7", "تحت 7", 2020, 2021, [("U7G1", "U7 Groupe 1", "U7 مجموعة 1")]),
    ("U5", "U5", "تحت 5", 2022, 2023, [("U5G1", "U5 Groupe 1", "U5 مجموعة 1")]),
]


@router.post("/teams/sync-structure")
def sync_season_team_structure(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Crée / complète catégories + équipes G1/G2 (U14…U5) pour la saison courante."""
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(400, "Aucune saison courante")
    disc = db.query(Discipline).order_by(Discipline.id).first()
    if not disc:
        raise HTTPException(400, "Aucune discipline configurée")

    created_cats = 0
    created_teams = 0
    updated = 0
    for code, name, name_ar, y1, y2, teams in _SEASON_TEAM_STRUCTURE:
        cat = (
            db.query(Category)
            .filter(Category.season_id == season.id, Category.code == code)
            .first()
        )
        if not cat:
            cat = Category(
                club_id=club_id,
                season_id=season.id,
                discipline_id=disc.id,
                code=code,
                name=name,
                name_ar=name_ar,
                birth_year_min=y1,
                birth_year_max=y2,
                is_active=True,
            )
            db.add(cat)
            db.flush()
            created_cats += 1
        else:
            cat.birth_year_min = y1
            cat.birth_year_max = y2
            cat.name = name
            cat.name_ar = name_ar
            cat.is_active = True
            if cat.club_id is None:
                cat.club_id = club_id
            updated += 1

        existing = db.query(Team).filter(Team.category_id == cat.id).all()
        by_code = {(t.code or "").upper().replace(" ", ""): t for t in existing}
        by_name = {t.name.strip().lower(): t for t in existing}
        for tcode, tname, tname_ar in teams:
            key = tcode.upper().replace(" ", "")
            team = by_code.get(key)
            if not team:
                # compat anciens noms (ex. "U13 Groupe 1", "u13 1")
                team = by_name.get(tname.lower())
            if not team:
                for t in existing:
                    raw = (t.code or t.name or "").upper().replace(" ", "")
                    if key in raw or raw in key:
                        team = t
                        break
            if team:
                team.name = tname
                team.name_ar = tname_ar
                team.code = tcode
                if team.club_id is None:
                    team.club_id = club_id
                updated += 1
            else:
                db.add(
                    Team(
                        club_id=club_id,
                        category_id=cat.id,
                        name=tname,
                        name_ar=tname_ar,
                        code=tcode,
                    )
                )
                created_teams += 1

    write_audit(
        db,
        action="sync",
        entity="teams",
        user_id=user.id,
        club_id=club_id,
        detail=f"cats+{created_cats} teams+{created_teams} upd={updated}",
        commit=False,
    )
    db.commit()
    _bust_club_caches()
    return {
        "season_id": season.id,
        "season": season.name,
        "categories_created": created_cats,
        "teams_created": created_teams,
        "updated": updated,
        "structure": [code for code, *_ in _SEASON_TEAM_STRUCTURE],
    }


@router.get("/stats/club")
def club_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Stats rapides : agrégats SQL + cache court (20 s), scopé par club."""
    now = monotonic()
    club_id = getattr(user, "club_id", None)
    cache_slot = _STATS_CACHE.get(club_id)
    if cache_slot and now - float(cache_slot["ts"]) < _STATS_TTL_SEC:
        return cache_slot["payload"]

    def _cf(query):
        if club_id:
            return query.filter(or_(Athlete.club_id == club_id, Athlete.club_id.is_(None)))
        return query

    season = db.query(Season).filter(Season.is_current.is_(True)).first()

    athletes_total = _cf(db.query(func.count(Athlete.id))).scalar() or 0
    athletes_active = (
        _cf(db.query(func.count(Athlete.id)).filter(Athlete.status == "Active")).scalar() or 0
    )
    athletes_left = (
        _cf(
            db.query(func.count(Athlete.id)).filter(
                Athlete.status.in_(["Abandonne", "Left", "Inactif"])
            )
        ).scalar()
        or 0
    )
    by_status = {
        status: int(count)
        for status, count in _cf(
            db.query(Athlete.status, func.count(Athlete.id))
        ).group_by(Athlete.status).all()
    }
    missing_birth = (
        _cf(db.query(func.count(Athlete.id)).filter(Athlete.birth_date.is_(None))).scalar() or 0
    )

    # Une seule lecture légère (id, status, année) pour classer par catégories
    light = _cf(db.query(Athlete.id, Athlete.status, Athlete.birth_date)).all()
    cats_out = []
    classified_active: set[int] = set()
    if season:
        cat_rows = (
            db.query(Category)
            .filter(Category.season_id == season.id)
            .order_by(Category.birth_year_min)
            .all()
        )
        for cat in cat_rows:
            birth_count = 0
            for aid, status, bdate in light:
                if bdate is None:
                    continue
                y = bdate.year
                if cat.birth_year_min <= y <= cat.birth_year_max:
                    birth_count += 1
                    if status == "Active":
                        classified_active.add(aid)
            cats_out.append(
                {
                    "code": cat.code,
                    "name": cat.name,
                    "name_ar": cat.name_ar,
                    "birth_years": f"{cat.birth_year_min}-{cat.birth_year_max}",
                    "members": birth_count,
                    "by_birth_year": birth_count,
                    "by_membership": 0,
                    "by_registration": 0,
                }
            )

    unclassified = sum(
        1
        for aid, status, bdate in light
        if status == "Active" and bdate is not None and aid not in classified_active
    )

    regs_pending = db.query(func.count(Registration.id)).filter(Registration.status == "pending").scalar() or 0
    parents = db.query(func.count(User.id)).filter(User.role == Role.PARENT).scalar() or 0
    payload = {
        "season": season.name if season else None,
        "athletes_total": int(athletes_total),
        "athletes_active": int(athletes_active),
        "athletes_left": int(athletes_left),
        "by_status": by_status,
        "categories": cats_out,
        "unclassified_active": unclassified,
        "missing_birth_date": int(missing_birth),
        "registrations_pending": int(regs_pending),
        "parents_count": int(parents),
    }
    _STATS_CACHE[club_id] = {"ts": now, "payload": payload}
    return payload


athletes_router = APIRouter(prefix="/athletes", tags=["athletes"])


def _parent_athlete_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id).all()
    return {r[0] for r in rows}


def _norm_name(name: str | None) -> str:
    if not name:
        return ""
    return " ".join(str(name).strip().lower().split())


def _find_duplicate_athlete(db: Session, full_name: str | None, birth_date) -> Athlete | None:
    """Cherche un athlète avec même nom (normalisé) et même date de naissance."""
    norm = _norm_name(full_name)
    if not norm or not birth_date:
        return None
    candidates = (
        db.query(Athlete)
        .filter(Athlete.birth_date == birth_date)
        .filter(func.lower(Athlete.full_name).like(f"%{norm.split()[0]}%"))
        .all()
    )
    for a in candidates:
        if _norm_name(a.full_name) == norm:
            return a
    return None


def _athlete_parent_phone(db: Session, athlete_id: int) -> str | None:
    link = db.query(ParentChild).filter(ParentChild.athlete_id == athlete_id).first()
    if not link:
        ec = db.query(EmergencyContact).filter(EmergencyContact.athlete_id == athlete_id).first()
        return ec.phone if ec else None
    parent = db.get(User, link.parent_id)
    return parent.phone if parent else None


_MISSING = object()


def _to_athlete_out(
    db: Session,
    athlete: Athlete,
    *,
    parent_phone: str | None | object = _MISSING,
    category_id: int | None = None,
    category_code: str | None = None,
) -> AthleteOut:
    # Important : si parent_phone vient du bulk (même None), ne pas retomber en N+1
    phone = (
        _athlete_parent_phone(db, athlete.id) if parent_phone is _MISSING else parent_phone  # type: ignore[arg-type]
    )
    return AthleteOut(
        id=athlete.id,
        legacy_number=athlete.legacy_number,
        full_name=athlete.full_name,
        full_name_ar=athlete.full_name_ar,
        birth_date=athlete.birth_date,
        birth_place=athlete.birth_place,
        status=athlete.status,
        license_number=athlete.license_number,
        notes=athlete.notes,
        photo_path=enrich_media_path(athlete.photo_path),
        blood_type=getattr(athlete, "blood_type", None),
        parent_phone=phone,  # type: ignore[arg-type]
        category_id=category_id,
        category_code=category_code,
    )


def _category_map_for_season(db: Session, season_id: int | None) -> list[Category]:
    q = db.query(Category)
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        if current:
            q = q.filter(Category.season_id == current.id)
    return q.order_by(Category.birth_year_min).all()


def _cat_for_birth(cats: list[Category], birth) -> tuple[int | None, str | None]:
    if not birth:
        return None, None
    year = birth.year if hasattr(birth, "year") else int(str(birth)[:4])
    for c in cats:
        if c.birth_year_min <= year <= c.birth_year_max:
            return c.id, c.code
    return None, None


@athletes_router.get("", response_model=list[AthleteOut])
def list_athletes(
    q: str | None = None,
    status: str | None = Query(None, alias="status"),
    category_id: int | None = None,
    season_id: int | None = None,
    sort: str = Query("recent"),
    order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    limit = min(limit, settings.max_page_size)
    cache_key = f"athletes:{club_id}:{user.role}:{user.id}:{q}:{status}:{category_id}:{season_id}:{sort}:{order}:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    season = season_id
    if not season:
        current = db.query(Season).filter(Season.is_current.is_(True)).first()
        season = current.id if current else None
    cats = _category_map_for_season(db, season)

    # Téléphones parents en une seule jointure (plus de requêtes N+1)
    parent_phone_sq = (
        db.query(ParentChild.athlete_id.label("aid"), func.max(User.phone).label("phone"))
        .join(User, User.id == ParentChild.parent_id)
        .group_by(ParentChild.athlete_id)
        .subquery()
    )
    ec_phone_sq = (
        db.query(EmergencyContact.athlete_id.label("aid"), func.max(EmergencyContact.phone).label("phone"))
        .group_by(EmergencyContact.athlete_id)
        .subquery()
    )

    query = (
        db.query(Athlete, func.coalesce(parent_phone_sq.c.phone, ec_phone_sq.c.phone).label("parent_phone"))
        .outerjoin(parent_phone_sq, parent_phone_sq.c.aid == Athlete.id)
        .outerjoin(ec_phone_sq, ec_phone_sq.c.aid == Athlete.id)
        .options(
            load_only(
                Athlete.id,
                Athlete.legacy_number,
                Athlete.full_name,
                Athlete.full_name_ar,
                Athlete.birth_date,
                Athlete.birth_place,
                Athlete.status,
                Athlete.license_number,
                Athlete.photo_path,
                Athlete.blood_type,
            )
        )
    )
    # Isolation tenant : uniquement les athlètes du club courant
    # (tolère les anciennes lignes NULL pendant la migration)
    query = query.filter(or_(Athlete.club_id == club_id, Athlete.club_id.is_(None)))
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        query = query.filter(Athlete.id.in_(ids or {-1}))
    if status:
        query = query.filter(Athlete.status == status)
    if q:
        query = query.filter(Athlete.full_name.ilike(f"%{q}%"))
    if category_id:
        cat = next((c for c in cats if c.id == category_id), None) or db.get(Category, category_id)
        if cat:
            query = query.filter(
                Athlete.birth_date.isnot(None),
                extract("year", Athlete.birth_date) >= cat.birth_year_min,
                extract("year", Athlete.birth_date) <= cat.birth_year_max,
            )
        else:
            query = query.filter(Athlete.id == -1)

    desc = order.lower() != "asc"
    sort_cols = {
        "recent": Athlete.id,
        "name": Athlete.full_name,
        "number": Athlete.legacy_number,
        "birth": Athlete.birth_date,
        "status": Athlete.status,
    }
    col = sort_cols.get(sort, Athlete.id)
    order_expr = col.desc() if desc else col.asc()
    try:
        order_expr = order_expr.nullslast()
    except Exception:
        pass
    # Tri stable secondaire par id pour éviter les doublons de pagination
    query = query.order_by(order_expr, Athlete.id.desc())

    rows = query.offset(skip).limit(limit).all()
    out: list[AthleteOut] = []
    for athlete, phone in rows:
        cid, ccode = _cat_for_birth(cats, athlete.birth_date)
        out.append(
            AthleteOut(
                id=athlete.id,
                legacy_number=athlete.legacy_number,
                full_name=athlete.full_name,
                full_name_ar=athlete.full_name_ar,
                birth_date=athlete.birth_date,
                birth_place=athlete.birth_place,
                status=athlete.status,
                license_number=athlete.license_number,
                notes=None,
                photo_path=enrich_media_path(athlete.photo_path),
                blood_type=getattr(athlete, "blood_type", None),
                parent_phone=phone,
                category_id=cid,
                category_code=ccode,
            )
        )
    cache_set(cache_key, out, 30)
    return out


@athletes_router.post("", response_model=AthleteOut)
def create_athlete(
    payload: AthleteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    dup = _find_duplicate_athlete(db, payload.full_name, payload.birth_date)
    if dup:
        raise HTTPException(
            409,
            f"Joueur déjà existant : {dup.full_name} (même nom et date de naissance). "
            f"Doublon évité.",
        )
    try:
        validate_club_age(payload.birth_date, required=True)
        if payload.parent_phone:
            validate_dz_mobile(payload.parent_phone, required=True)
        if payload.blood_type is not None:
            payload.blood_type = validate_blood_type(payload.blood_type)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    data = payload.model_dump(exclude={"parent_phone", "parent_name"})
    if "blood_type" in data:
        data["blood_type"] = validate_blood_type(data.get("blood_type"))
    athlete = Athlete(club_id=club_id, **data)
    db.add(athlete)
    db.flush()
    write_audit(
        db,
        action="create",
        entity="athlete",
        entity_id=athlete.id,
        user_id=user.id,
        detail=athlete.full_name,
    )
    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        db.add(
            EmergencyContact(
                club_id=club_id,
                athlete_id=athlete.id,
                name=payload.parent_name or "Parent",
                phone=normalize_phone(payload.parent_phone) or payload.parent_phone,
                relation="parent",
            )
        )
    db.commit()
    db.refresh(athlete)
    _bust_club_caches()
    return _to_athlete_out(db, athlete)


@athletes_router.get("/{athlete_id}", response_model=AthleteOut)
def get_athlete(
    athlete_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)
    if user.role == Role.PARENT and athlete_id not in _parent_athlete_ids(db, user):
        raise HTTPException(403, "Accès refusé")
    return _to_athlete_out(db, athlete)


@athletes_router.patch("/{athlete_id}", response_model=AthleteOut)
def update_athlete(
    athlete_id: int,
    payload: AthleteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH)),
    club_id: int = Depends(get_current_club_id),
):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)

    data = payload.model_dump(exclude_unset=True, exclude={"confirm_status", "parent_phone", "parent_name"})
    new_status = data.get("status")
    if new_status and new_status != athlete.status:
        if new_status in {"Abandonne", "Left", "Inactif"} and not payload.confirm_status:
            raise HTTPException(
                400,
                "Confirmation requise pour changer le statut (confirm_status=true). Ajoutez une note.",
            )
        if new_status in {"Abandonne", "Left", "Inactif"} and not (payload.notes or athlete.notes):
            raise HTTPException(400, "Une note est obligatoire quand le joueur quitte le club.")

    birth = data.get("birth_date", athlete.birth_date)
    try:
        if "birth_date" in data:
            validate_club_age(birth, required=True)
        if payload.parent_phone:
            validate_dz_mobile(payload.parent_phone, required=True)
        if "blood_type" in data:
            data["blood_type"] = validate_blood_type(data.get("blood_type"))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    for k, v in data.items():
        setattr(athlete, k, v)

    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if new_status and new_status in {"Abandonne", "Left", "Inactif"}:
        note = payload.notes or athlete.notes or ""
        title = f"Joueur — {athlete.full_name}"
        body = f"Statut mis à jour : {new_status}. {note}".strip()
        notify_parents_of_athlete(db, athlete.id, title, body, kind="status")
        notify_role(db, Role.ADMIN, title, body, kind="status")

    write_audit(
        db,
        action="update",
        entity="athlete",
        entity_id=athlete.id,
        user_id=user.id,
        detail=f"status={athlete.status}",
    )
    db.commit()
    db.refresh(athlete)
    _bust_club_caches()
    return _to_athlete_out(db, athlete)


@athletes_router.delete("/{athlete_id}")
def delete_athlete(
    athlete_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)
    # cascade-ish cleanup of related rows
    for model in (Attendance, Convocation, FeeInstallment, Payment, TeamMembership, ParentChild, EmergencyContact, Registration):
        db.query(model).filter(getattr(model, "athlete_id") == athlete_id).delete(synchronize_session=False)
    write_audit(
        db,
        action="delete",
        entity="athlete",
        entity_id=athlete_id,
        user_id=user.id,
        club_id=club_id,
        detail=athlete.full_name,
    )
    db.delete(athlete)
    db.commit()
    _bust_club_caches()
    return {"deleted": athlete_id}


@router.post("/system/cleanup-tests")
def cleanup_test_batch(
    marker: str = TEST_MARKER,
    confirm: bool = Query(False, description="Doit être true"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime les données de test. En production : ALLOW_TEST_CLEANUP=true + confirm=true."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true pour confirmer la purge des tests.")
    if settings.is_production and not settings.allow_test_cleanup:
        raise HTTPException(
            403,
            "Cleanup tests désactivé en production (définir ALLOW_TEST_CLEANUP=true si besoin).",
        )
    athletes = (
        db.query(Athlete)
        .filter(
            (Athlete.notes.contains(marker))
            | (Athlete.full_name.contains("[TEST]"))
            | (Athlete.full_name.contains("[VERIFY]"))
            | (Athlete.notes.contains("VERIFY"))
        )
        .all()
    )
    ids = [a.id for a in athletes]
    deleted_events = 0
    # events titled with marker
    events = db.query(Event).filter(Event.title.contains(marker)).all()
    for ev in events:
        db.query(Attendance).filter(Attendance.event_id == ev.id).delete(synchronize_session=False)
        db.query(Convocation).filter(Convocation.event_id == ev.id).delete(synchronize_session=False)
        db.delete(ev)
        deleted_events += 1
    for athlete_id in ids:
        for model in (Attendance, Convocation, FeeInstallment, Payment, TeamMembership, ParentChild, EmergencyContact, Registration):
            db.query(model).filter(getattr(model, "athlete_id") == athlete_id).delete(synchronize_session=False)
        ath = db.get(Athlete, athlete_id)
        if ath:
            db.delete(ath)
    # test parent users by phone prefix 069911
    parents = db.query(User).filter(User.role == Role.PARENT, User.phone.like("069911%")).all()
    parent_ids = [p.id for p in parents]
    if parent_ids:
        db.query(Notification).filter(Notification.user_id.in_(parent_ids)).delete(synchronize_session=False)
        db.query(ParentChild).filter(ParentChild.parent_id.in_(parent_ids)).delete(synchronize_session=False)
    for p in parents:
        db.delete(p)
    anns = db.query(Announcement).filter(Announcement.title.contains(marker)).all()
    for a in anns:
        db.delete(a)
    # staff notifications created by the test batch (cancel / status)
    db.query(Notification).filter(Notification.title.contains(marker) | Notification.body.contains(marker)).delete(
        synchronize_session=False
    )
    db.commit()
    return {
        "marker": marker,
        "athletes_deleted": len(ids),
        "athlete_ids": ids,
        "events_deleted": deleted_events,
        "parents_deleted": len(parent_ids),
        "announcements_deleted": len(anns),
    }


@router.post("/system/backfill-fees")
def backfill_fees(
    confirm: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    regs = (
        db.query(Registration)
        .filter(Registration.status == "approved", Registration.subscription_fee.isnot(None))
        .all()
    )
    created = 0
    for reg in regs:
        before = (
            db.query(FeeInstallment)
            .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
            .count()
        )
        ensure_subscription_installment(db, reg)
        db.flush()
        after = (
            db.query(FeeInstallment)
            .filter(FeeInstallment.registration_id == reg.id, FeeInstallment.label == "inscription")
            .count()
        )
        if after > before:
            created += 1
    db.commit()
    return {"registrations": len(regs), "installments_created": created}


@router.post("/system/prune-old-teams")
def prune_old_teams(
    confirm: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime les équipes liées à des catégories hors saison courante, sans memberships actives."""
    if not confirm:
        raise HTTPException(400, "Ajoutez ?confirm=true")
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(400, "Aucune saison courante")
    keep_cat_ids = {c.id for c in db.query(Category).filter(Category.season_id == season.id)}
    deleted = []
    kept = []
    for team in db.query(Team).all():
        if team.category_id in keep_cat_ids:
            kept.append(team.id)
            continue
        active = (
            db.query(TeamMembership)
            .filter(TeamMembership.team_id == team.id, TeamMembership.is_active.is_(True))
            .count()
        )
        if active:
            kept.append(team.id)
            continue
        db.query(Event).filter(Event.team_id == team.id).update({Event.team_id: None}, synchronize_session=False)
        db.query(TeamCoach).filter(TeamCoach.team_id == team.id).delete(synchronize_session=False)
        db.query(TeamMembership).filter(TeamMembership.team_id == team.id).delete(synchronize_session=False)
        deleted.append({"id": team.id, "name": team.name, "category_id": team.category_id})
        db.delete(team)
    db.commit()
    return {"season": season.name, "deleted": deleted, "kept_count": len(kept)}


reg_router = APIRouter(prefix="/registrations", tags=["registrations"])


def _reg_out_from_maps(
    reg: Registration,
    athletes: dict[int, Athlete],
    categories: dict[int, Category],
    phones: dict[int, str | None],
    parent_meta: dict | None = None,
) -> RegistrationOut:
    athlete = athletes.get(reg.athlete_id)
    cat = categories.get(reg.category_id) if reg.category_id else None
    return RegistrationOut(
        id=reg.id,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        seq_no=getattr(reg, "seq_no", None),
        reference=getattr(reg, "reference", None),
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=phones.get(reg.athlete_id),
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
    )


def _reg_out(db: Session, reg: Registration, parent_meta: dict | None = None) -> RegistrationOut:
    athlete = db.get(Athlete, reg.athlete_id)
    cat = db.get(Category, reg.category_id) if reg.category_id else None
    parent_phone = _athlete_parent_phone(db, reg.athlete_id)
    return RegistrationOut(
        id=reg.id,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        seq_no=getattr(reg, "seq_no", None),
        reference=getattr(reg, "reference", None),
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=parent_phone,
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
    )


def _bulk_parent_phones(db: Session, athlete_ids: list[int]) -> dict[int, str | None]:
    if not athlete_ids:
        return {}
    out: dict[int, str | None] = {aid: None for aid in athlete_ids}
    links = db.query(ParentChild).filter(ParentChild.athlete_id.in_(athlete_ids)).all()
    parent_ids = {l.parent_id for l in links}
    parents = {u.id: u for u in db.query(User).filter(User.id.in_(parent_ids)).all()} if parent_ids else {}
    for link in links:
        parent = parents.get(link.parent_id)
        if parent and parent.phone:
            out[link.athlete_id] = parent.phone
    missing = [aid for aid, phone in out.items() if not phone]
    if missing:
        ecs = db.query(EmergencyContact).filter(EmergencyContact.athlete_id.in_(missing)).all()
        for ec in ecs:
            if out.get(ec.athlete_id) is None:
                out[ec.athlete_id] = ec.phone
    return out


@reg_router.get("", response_model=list[RegistrationOut])
def list_registrations(
    season_id: int | None = None,
    status: str | None = None,
    category_id: int | None = None,
    sort: str = Query("recent"),
    order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
    club_id: int = Depends(get_current_club_id),
):
    limit = min(limit, settings.max_page_size)
    cache_key = f"regs:{club_id}:{user.role}:{user.id}:{season_id}:{status}:{category_id}:{sort}:{order}:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    q = db.query(Registration).filter(
        or_(Registration.club_id == club_id, Registration.club_id.is_(None))
    )
    if season_id:
        q = q.filter(Registration.season_id == season_id)
    if status:
        q = q.filter(Registration.status == status)
    else:
        # Masquer les dossiers archivés par défaut (récupérables via status=archived)
        q = q.filter(Registration.status != "archived")
    if category_id:
        q = q.filter(Registration.category_id == category_id)
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        q = q.filter(Registration.athlete_id.in_(ids or {-1}))

    desc = order.lower() != "asc"
    if sort == "name":
        q = q.outerjoin(Athlete, Athlete.id == Registration.athlete_id)
        name_col = Athlete.full_name
        order_expr = name_col.desc() if desc else name_col.asc()
    else:
        sort_cols = {
            "recent": Registration.id,
            "date": Registration.registered_on,
            "status": Registration.status,
            "category": Registration.category_id,
            "number": Registration.seq_no,
            "reference": Registration.reference,
        }
        col = sort_cols.get(sort, Registration.id)
        order_expr = col.desc() if desc else col.asc()
    try:
        order_expr = order_expr.nullslast()
    except Exception:
        pass
    rows = q.order_by(order_expr, Registration.id.desc()).offset(skip).limit(limit).all()
    if not rows:
        cache_set(cache_key, [], 25)
        return []
    athlete_ids = list({r.athlete_id for r in rows})
    cat_ids = list({r.category_id for r in rows if r.category_id})
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()}
    categories = (
        {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    )
    phones = _bulk_parent_phones(db, athlete_ids)
    out = [_reg_out_from_maps(r, athletes, categories, phones) for r in rows]
    cache_set(cache_key, out, 25)
    return out


@reg_router.post("", response_model=RegistrationOut)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
    club_id: int = Depends(get_current_club_id),
):
    athlete_id = payload.athlete_id
    parent_meta: dict = {}
    birth = payload.athlete.birth_date if payload.athlete else None

    season = db.get(Season, payload.season_id)
    if not season:
        raise HTTPException(400, "Saison introuvable")
    if not season.registration_open and user.role not in {Role.ADMIN, Role.DIRECTION}:
        raise HTTPException(403, "Inscriptions fermées pour cette saison")

    category_id = payload.category_id
    cat: Category | None = db.get(Category, category_id) if category_id else None
    if category_id and not cat:
        raise HTTPException(400, "Catégorie introuvable")
    if cat and cat.season_id != payload.season_id:
        raise HTTPException(400, "Catégorie hors saison sélectionnée")

    # Parent : soit nouvel athlète, soit athlète déjà lié — jamais d'IDOR
    if user.role == Role.PARENT and athlete_id and not payload.athlete:
        if athlete_id not in _parent_athlete_ids(db, user):
            raise HTTPException(403, "Athlète non lié à votre compte")

    if payload.athlete:
        try:
            validate_club_age(payload.athlete.birth_date, required=True)
            validate_category_for_birth(payload.athlete.birth_date, cat)
            if payload.athlete.blood_type is not None:
                payload.athlete.blood_type = validate_blood_type(payload.athlete.blood_type)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        # Anti-doublon : même nom + date de naissance déjà en base
        existing_dup = _find_duplicate_athlete(db, payload.athlete.full_name, payload.athlete.birth_date)
        if existing_dup:
            dup_reg = (
                db.query(Registration)
                .filter(
                    Registration.athlete_id == existing_dup.id,
                    Registration.season_id == payload.season_id,
                )
                .first()
            )
            if dup_reg:
                raise HTTPException(
                    409,
                    f"Joueur déjà inscrit cette saison : {existing_dup.full_name} "
                    f"(même nom et date de naissance). Inscription annulée pour éviter un doublon.",
                )
            # Athlète connu mais pas encore inscrit cette saison → on réutilise
            athlete_id = existing_dup.id
            birth = existing_dup.birth_date
            if user.role == Role.PARENT and not db.query(ParentChild).filter_by(
                parent_id=user.id, athlete_id=existing_dup.id
            ).first():
                db.add(ParentChild(club_id=club_id, parent_id=user.id, athlete_id=existing_dup.id))
        else:
            athlete_data = payload.athlete.model_dump(exclude={"parent_phone", "parent_name"})
            if payload.photo_path:
                athlete_data["photo_path"] = payload.photo_path
            if "blood_type" in athlete_data:
                athlete_data["blood_type"] = validate_blood_type(athlete_data.get("blood_type"))
            athlete = Athlete(club_id=club_id, **athlete_data)
            db.add(athlete)
            db.flush()
            athlete_id = athlete.id
            birth = athlete.birth_date
            if user.role == Role.PARENT:
                db.add(ParentChild(club_id=club_id, parent_id=user.id, athlete_id=athlete.id))
    if not athlete_id:
        raise HTTPException(400, "Athlète requis")

    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(400, "Athlète introuvable")
    birth = birth or athlete.birth_date

    try:
        validate_club_age(birth, required=True)
        if cat:
            validate_category_for_birth(birth, cat)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    dup = (
        db.query(Registration)
        .filter(Registration.athlete_id == athlete_id, Registration.season_id == payload.season_id)
        .first()
    )
    if dup:
        raise HTTPException(400, "Inscription déjà existante pour cet athlète sur cette saison")

    if payload.photo_path:
        athlete.photo_path = payload.photo_path

    parent_phone = payload.parent_phone or (payload.athlete.parent_phone if payload.athlete else None)
    parent_name = payload.parent_name or (payload.athlete.parent_name if payload.athlete else None)

    if parent_phone and user.role != Role.PARENT:
        try:
            validate_dz_mobile(parent_phone, required=True)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if user.role == Role.PARENT:
        # Lien déjà créé pour nouvel athlète, ou déjà vérifié pour athlète existant
        if not db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete_id).first():
            raise HTTPException(403, "Athlète non lié à votre compte")
    elif parent_phone:
        try:
            parent, temp_pw, created = ensure_parent_account(
                db,
                phone=parent_phone,
                full_name=parent_name,
                athlete_id=athlete_id,
            )
            parent_meta = {"temp_password": temp_pw, "created": created, "phone": parent.phone}
            if payload.parent_password and created:
                parent.password_hash = hash_password(payload.parent_password)
                parent.must_change_password = True
                parent_meta["temp_password"] = payload.parent_password
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if parent_phone or payload.emergency_phone:
        phone = normalize_phone(payload.emergency_phone or parent_phone or "") or (
            payload.emergency_phone or parent_phone
        )
        db.add(
            EmergencyContact(
                club_id=club_id,
                athlete_id=athlete_id,
                name=payload.emergency_name or parent_name or "Parent",
                phone=phone or "",
                relation="parent",
            )
        )

    if not category_id and birth:
        year = birth.year
        auto = (
            db.query(Category)
            .filter(
                Category.season_id == payload.season_id,
                Category.birth_year_min <= year,
                Category.birth_year_max >= year,
                Category.is_active.is_(True),
            )
            .first()
        )
        if auto:
            category_id = auto.id
            cat = auto
        else:
            raise HTTPException(
                400,
                f"Aucune catégorie pour l'année {year} sur cette saison. Vérifiez la date de naissance.",
            )
    elif category_id and birth:
        try:
            validate_category_for_birth(birth, cat)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    reg = Registration(
        club_id=club_id,
        athlete_id=athlete_id,
        season_id=payload.season_id,
        category_id=category_id,
        registered_on=payload.registered_on or date.today(),
        status="pending" if user.role == Role.PARENT else "approved",
        source=payload.source or ("mobile" if user.role == Role.PARENT else "web"),
        subscription_fee=payload.subscription_fee,
    )
    from app.services.references import assign_registration_identity

    assign_registration_identity(
        db,
        reg,
        club_id=club_id,
        season=season,
        category=cat,
    )
    db.add(reg)
    db.flush()

    if category_id and reg.status == "approved":
        team = db.query(Team).filter(Team.category_id == category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=athlete_id, season_id=payload.season_id
        ).first():
            db.add(
                TeamMembership(
                    club_id=club_id,
                    team_id=team.id,
                    athlete_id=athlete_id,
                    season_id=payload.season_id,
                )
            )
        ensure_season_fee_bundle(db, reg)

    write_audit(
        db,
        action="create",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        detail=f"athlete={athlete_id} season={payload.season_id} status={reg.status}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg, parent_meta)


@reg_router.post("/{reg_id}/approve", response_model=RegistrationOut)
def approve_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    athlete = db.get(Athlete, reg.athlete_id)
    cat = db.get(Category, reg.category_id) if reg.category_id else None
    if athlete:
        try:
            validate_club_age(athlete.birth_date, required=True)
            validate_category_for_birth(athlete.birth_date, cat)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    reg.status = "approved"
    if reg.category_id:
        team = db.query(Team).filter(Team.category_id == reg.category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id
        ).first():
            db.add(
                TeamMembership(team_id=team.id, athlete_id=reg.athlete_id, season_id=reg.season_id)
            )
    ensure_season_fee_bundle(db, reg)
    if athlete:
        notify_parents_of_athlete(
            db,
            athlete.id,
            "Inscription approuvée / تم قبول التسجيل",
            f"{athlete.full_name} — saison validée.",
            kind="registration",
        )
    write_audit(
        db,
        action="approve",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        detail=f"athlete={reg.athlete_id}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


@reg_router.post("/{reg_id}/reject", response_model=RegistrationOut)
def reject_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    if reg.status == "approved":
        raise HTTPException(400, "Inscription déjà approuvée")
    reg.status = "rejected"
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


@reg_router.post("/{reg_id}/archive", response_model=RegistrationOut)
def archive_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Archive une inscription (soft-delete) — reste dans l'historique."""
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    prev = reg.status
    reg.status = "archived"
    write_audit(
        db,
        action="archive",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"from={prev} athlete={reg.athlete_id}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


@reg_router.post("/{reg_id}/restore", response_model=RegistrationOut)
def restore_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Restaure une inscription archivée → pending."""
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    if reg.status != "archived":
        raise HTTPException(400, "Seules les inscriptions archivées peuvent être restaurées")
    reg.status = "pending"
    write_audit(
        db,
        action="restore",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"athlete={reg.athlete_id}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


audit_router = APIRouter(prefix="/audit", tags=["audit"])


@audit_router.get("")
def list_audit(
    entity: str | None = None,
    action: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Historique des opérations (récupération / traçabilité)."""
    q = db.query(AuditLog).filter(or_(AuditLog.club_id == club_id, AuditLog.club_id.is_(None)))
    if entity:
        q = q.filter(AuditLog.entity == entity)
    if action:
        q = q.filter(AuditLog.action == action)
    rows = q.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    user_ids = {r.user_id for r in rows if r.user_id}
    names = (
        {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )
    return [
        {
            "id": r.id,
            "action": r.action,
            "entity": r.entity,
            "entity_id": r.entity_id,
            "detail": r.detail,
            "user_id": r.user_id,
            "user_name": names.get(r.user_id) if r.user_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
