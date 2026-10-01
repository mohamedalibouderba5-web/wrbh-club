from calendar import month_abbr
from datetime import date, datetime, timezone
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session, load_only

from app.api.deps import get_current_user, require_roles
from app.core.tenant import assert_same_club, get_current_club_id
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role, TEAM_COACH_ROLES
from app.core.security import hash_password
from app.models import (
    Announcement,
    Athlete,
    Attachment,
    Attendance,
    AuditLog,
    Category,
    Convocation,
    Discipline,
    EmergencyContact,
    Event,
    FeeInstallment,
    InventoryAssignment,
    InventoryItem,
    LedgerEntry,
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
    CategoryCreate,
    CategoryOut,
    DisciplineCreate,
    DisciplineOut,
    RegistrationCreate,
    RegistrationOut,
    RegistrationUpdate,
    SeasonOut,
    TeamCoachAssignIn,
    TeamCoachOut,
    TeamCreate,
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
from app.services.media import enrich_media_path, extract_media_id, media_public_path
from app.services.sports import (
    SPORT_LABELS,
    SPORT_LABELS_AR,
    category_code_for,
    default_age_bands,
    normalize_sport,
    sport_code_short,
)

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
    cache_delete_prefix("analytics:")
    _STATS_CACHE.clear()


def _current_season(db: Session, club_id: int | None) -> Season | None:
    """Saison courante du club (jamais celle d'un autre tenant)."""
    if club_id:
        s = (
            db.query(Season)
            .filter(Season.is_current.is_(True), Season.club_id == club_id)
            .first()
        )
        if s:
            return s
        s = (
            db.query(Season)
            .filter(Season.is_current.is_(True), Season.club_id.is_(None))
            .first()
        )
        if s:
            return s
    return db.query(Season).filter(Season.is_current.is_(True)).first()


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


@router.post("/seasons/{season_id}/archive-roster")
def archive_season_roster(
    season_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Archive les joueurs d'une saison (ex. 2025/2026) : dossiers archivés + athlètes Abandonne
    s'ils n'ont pas d'inscription active sur une autre saison (ex. courante)."""
    season = db.get(Season, season_id)
    if not season:
        raise HTTPException(404, "Saison introuvable")
    assert_same_club(season, club_id)

    regs = (
        db.query(Registration)
        .filter(
            Registration.season_id == season_id,
            or_(Registration.club_id == club_id, Registration.club_id.is_(None)),
            Registration.status != "archived",
        )
        .all()
    )
    athlete_ids = {r.athlete_id for r in regs}
    archived_regs = 0
    for reg in regs:
        reg.status = "archived"
        from app.services.references import release_registration_identity

        release_registration_identity(reg)  # conserve référence, libère seulement le kit
        archived_regs += 1

    current = db.query(Season).filter(Season.is_current.is_(True)).first()
    archived_athletes = 0
    for aid in athlete_ids:
        athlete = db.get(Athlete, aid)
        if not athlete:
            continue
        keep_active = False
        if current and current.id != season_id:
            other = (
                db.query(Registration.id)
                .filter(
                    Registration.athlete_id == aid,
                    Registration.season_id == current.id,
                    Registration.status != "archived",
                )
                .first()
            )
            if other:
                keep_active = True
        if keep_active:
            continue
        if athlete.status not in _ARCHIVED_ATHLETE_STATUSES:
            athlete.status = "Abandonne"
            note = f"Archivé saison {season.name}"
            if athlete.notes and note not in athlete.notes:
                athlete.notes = f"{athlete.notes}\n{note}".strip()
            elif not athlete.notes:
                athlete.notes = note
            archived_athletes += 1

    # Archive caisse / dépenses / recettes de la saison (soft)
    from app.models import LedgerEntry

    ledger_q = db.query(LedgerEntry).filter(
        or_(LedgerEntry.club_id == club_id, LedgerEntry.club_id.is_(None)),
        or_(LedgerEntry.is_archived.is_(False), LedgerEntry.is_archived.is_(None)),
    )
    # season_id sur ledger si présent
    if hasattr(LedgerEntry, "season_id"):
        ledger_rows = ledger_q.filter(LedgerEntry.season_id == season_id).all()
    else:
        ledger_rows = []
    archived_ledger = 0
    for entry in ledger_rows:
        entry.is_archived = True
        archived_ledger += 1

    # Désactive la saison archivée (n'est plus courante)
    if season.is_current and current and current.id == season_id:
        pass  # ne pas laisser le club sans saison courante
    elif not season.is_current:
        season.registration_open = False

    write_audit(
        db,
        action="archive_roster",
        entity="season",
        entity_id=season_id,
        user_id=user.id,
        club_id=club_id,
        detail=(
            f"season={season.name} regs={archived_regs} athletes={archived_athletes} "
            f"ledger={archived_ledger}"
        ),
    )
    db.commit()
    _bust_club_caches()
    cache_delete_prefix("finance:")
    return {
        "ok": True,
        "season_id": season_id,
        "season": season.name,
        "archived_registrations": archived_regs,
        "archived_athletes": archived_athletes,
        "archived_ledger": archived_ledger,
        "message": "Saison archivée — réinscription possible via reprise archive",
    }


def _category_out(cat: Category, disc: Discipline | None = None) -> CategoryOut:
    return CategoryOut(
        id=cat.id,
        season_id=cat.season_id,
        code=cat.code,
        name=cat.name,
        name_ar=cat.name_ar,
        birth_year_min=cat.birth_year_min,
        birth_year_max=cat.birth_year_max,
        is_active=cat.is_active,
        discipline_id=cat.discipline_id,
        discipline_code=disc.code if disc else None,
        discipline_name=disc.name if disc else None,
    )


@router.get("/disciplines", response_model=list[DisciplineOut])
def list_disciplines(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    club_id: int = Depends(get_current_club_id),
):
    """Sports / activités du club (un club peut être multisport)."""
    rows = (
        db.query(Discipline)
        .filter(or_(Discipline.club_id == club_id, Discipline.club_id.is_(None)))
        .order_by(Discipline.name)
        .all()
    )
    out: list[DisciplineOut] = []
    for d in rows:
        n = (
            db.query(func.count(Category.id))
            .filter(Category.discipline_id == d.id)
            .scalar()
            or 0
        )
        out.append(
            DisciplineOut(
                id=d.id,
                club_id=d.club_id,
                code=d.code,
                name=d.name,
                name_ar=d.name_ar,
                categories_count=int(n),
            )
        )
    return out


@router.post("/disciplines", response_model=DisciplineOut)
def add_discipline(
    payload: DisciplineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Ajoute un sport au club (ex. football + judo + natation)."""
    sport = normalize_sport(payload.sport)
    code = sport_code_short(sport)
    existing = (
        db.query(Discipline)
        .filter(
            or_(Discipline.club_id == club_id, Discipline.club_id.is_(None)),
            Discipline.code == code,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Sport déjà présent : {existing.name}")

    disc = Discipline(
        club_id=club_id,
        code=code,
        name=(payload.name or SPORT_LABELS.get(sport, sport.title())).strip(),
        name_ar=(payload.name_ar or SPORT_LABELS_AR.get(sport)),
    )
    db.add(disc)
    db.flush()

    cats_created = 0
    if payload.seed_categories:
        cur = (
            db.query(Season)
            .filter(Season.is_current.is_(True), or_(Season.club_id == club_id, Season.club_id.is_(None)))
            .first()
        )
        if cur:
            for suffix, name, name_ar, ymin, ymax in default_age_bands(sport):
                cat_code = category_code_for(sport, suffix)
                if (
                    db.query(Category)
                    .filter(Category.season_id == cur.id, Category.code == cat_code)
                    .first()
                ):
                    continue
                db.add(
                    Category(
                        club_id=club_id,
                        season_id=cur.id,
                        discipline_id=disc.id,
                        code=cat_code,
                        name=f"{disc.name} {name}",
                        name_ar=f"{(disc.name_ar or '')} {name_ar}".strip(),
                        birth_year_min=ymin,
                        birth_year_max=ymax,
                        is_active=True,
                    )
                )
                cats_created += 1

    write_audit(
        db,
        action="create",
        entity="discipline",
        entity_id=disc.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"sport={sport} cats={cats_created}",
    )
    db.commit()
    db.refresh(disc)
    _bust_club_caches()
    return DisciplineOut(
        id=disc.id,
        club_id=disc.club_id,
        code=disc.code,
        name=disc.name,
        name_ar=disc.name_ar,
        categories_count=cats_created,
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    season_id: int | None = None,
    discipline_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    club_id = getattr(user, "club_id", None)
    key = f"categories:{club_id}:{season_id or 'current'}:{discipline_id or 'all'}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    q = db.query(Category)
    if club_id:
        q = q.filter(or_(Category.club_id == club_id, Category.club_id.is_(None)))
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = _current_season(db, club_id)
        if current:
            q = q.filter(Category.season_id == current.id)
    if discipline_id:
        q = q.filter(Category.discipline_id == discipline_id)
    rows = q.order_by(Category.birth_year_min).all()
    disc_ids = {c.discipline_id for c in rows if c.discipline_id}
    discs = {
        d.id: d
        for d in db.query(Discipline).filter(Discipline.id.in_(disc_ids or {-1})).all()
    }
    out = [_category_out(c, discs.get(c.discipline_id)) for c in rows]
    cache_set(key, out, 120)
    return out


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Un seul appel : saisons + catégories + stats + finance (si staff) + compte événements."""
    club_id = getattr(user, "club_id", None)
    key = f"bootstrap:{club_id}:{user.role}:{user.id}"
    cached = cache_get(key)
    if cached is not None:
        return cached

    seasons = list_seasons(db, user)
    try:
        # list_categories(season_id, discipline_id, db, user)
        categories = list_categories(None, None, db, user)
    except Exception:
        categories = []
    stats = club_stats(db, user)
    events_q = db.query(func.count(Event.id)).filter(Event.is_cancelled.is_(False))
    if club_id:
        events_q = events_q.filter(or_(Event.club_id == club_id, Event.club_id.is_(None)))
    events_count = events_q.scalar() or 0
    finance = None
    if user.role in {Role.ADMIN, Role.DIRECTION, Role.STAFF} and club_id:
        from app.api.finance import finance_dashboard

        try:
            # finance_dashboard(season_id, db, user, club_id)
            finance = finance_dashboard(None, db, user, int(club_id))
        except Exception:
            finance = None

    analytics = None
    try:
        analytics = club_analytics(db, user)
    except Exception:
        analytics = None

    payload = {
        "seasons": [s.model_dump() if hasattr(s, "model_dump") else s for s in seasons],
        "categories": [c.model_dump() if hasattr(c, "model_dump") else c for c in categories],
        "stats": stats,
        "events_count": int(events_count),
        "finance": finance,
        "analytics": analytics,
    }
    if club_id:
        from app.core.tenant import club_trial_meta
        from app.models import Club as ClubModel

        club_row = db.get(ClubModel, int(club_id))
        if club_row:
            payload["club"] = club_trial_meta(club_row)
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
        if not coach or coach.role not in TEAM_COACH_ROLES:
            raise HTTPException(400, f"Utilisateur {item.user_id} ne peut pas être entraîneur")
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
    """Liste des entraîneurs assignables + catégories/équipes liées."""
    q = db.query(User).filter(
        User.role.in_(tuple(TEAM_COACH_ROLES)),
        or_(User.club_id == club_id, User.club_id.is_(None)),
    )
    if not include_inactive:
        q = q.filter(User.is_active.is_(True))
    rows = q.order_by(User.full_name).all()
    cur = db.query(Season).filter(Season.is_current.is_(True)).first()
    cat_ids = set()
    if cur:
        cat_ids = {c.id for c in db.query(Category.id).filter(Category.season_id == cur.id)}
    out = []
    for u in rows:
        links = (
            db.query(TeamCoach, Team, Category)
            .join(Team, Team.id == TeamCoach.team_id)
            .outerjoin(Category, Category.id == Team.category_id)
            .filter(TeamCoach.user_id == u.id)
            .all()
        )
        teams_info = []
        for tc, team, cat in links:
            if cat_ids and team.category_id not in cat_ids:
                continue
            teams_info.append(
                {
                    "team_id": team.id,
                    "team_name": team.name,
                    "team_code": team.code,
                    "category_code": cat.code if cat else None,
                    "category_name": cat.name if cat else None,
                    "role_label": tc.role_label,
                }
            )
        cats = sorted({t["category_code"] for t in teams_info if t.get("category_code")})
        out.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "full_name_ar": u.full_name_ar,
                "phone": u.phone,
                "email": u.email,
                "is_active": u.is_active,
                "role": u.role,
                "categories": cats,
                "teams": teams_info,
            }
        )
    return out


@router.post("/categories", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    season_id = payload.season_id
    if not season_id:
        cur = db.query(Season).filter(Season.is_current.is_(True)).first()
        if not cur:
            raise HTTPException(400, "Aucune saison courante")
        season_id = cur.id
    disc_id = payload.discipline_id
    if not disc_id:
        disc = db.query(Discipline).filter(or_(Discipline.club_id == club_id, Discipline.club_id.is_(None))).first()
        if not disc:
            raise HTTPException(400, "Aucune discipline configurée")
        disc_id = disc.id
    code = payload.code.strip().upper()
    exists = (
        db.query(Category)
        .filter(Category.season_id == season_id, Category.code == code)
        .first()
    )
    if exists:
        raise HTTPException(400, f"Catégorie {code} déjà existante")
    if payload.birth_year_min > payload.birth_year_max:
        raise HTTPException(400, "Année min > année max")
    cat = Category(
        club_id=club_id,
        season_id=season_id,
        discipline_id=disc_id,
        code=code,
        name=payload.name.strip(),
        name_ar=payload.name_ar,
        birth_year_min=payload.birth_year_min,
        birth_year_max=payload.birth_year_max,
        is_active=True,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    _bust_club_caches()
    disc = db.get(Discipline, cat.discipline_id) if cat.discipline_id else None
    return _category_out(cat, disc)


@router.post("/teams", response_model=TeamOut)
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Création personnalisée : catégorie existante ou nouvelle + équipe G1/G2/G3 auto."""
    season_id = payload.season_id
    if not season_id:
        cur = db.query(Season).filter(Season.is_current.is_(True)).first()
        if not cur:
            raise HTTPException(400, "Aucune saison courante")
        season_id = cur.id

    cat: Category | None = None
    if payload.category_id:
        cat = db.get(Category, payload.category_id)
        if not cat:
            raise HTTPException(404, "Catégorie introuvable")
    else:
        if not payload.category_code or not payload.category_name:
            raise HTTPException(400, "category_id ou category_code+name requis")
        if payload.birth_year_min is None or payload.birth_year_max is None:
            raise HTTPException(400, "birth_year_min et birth_year_max requis pour une nouvelle catégorie")
        if payload.birth_year_min > payload.birth_year_max:
            raise HTTPException(400, "Année min > année max")
        disc = db.query(Discipline).filter(or_(Discipline.club_id == club_id, Discipline.club_id.is_(None))).first()
        if not disc:
            raise HTTPException(400, "Aucune discipline configurée")
        code_new = payload.category_code.strip().upper()
        if db.query(Category).filter(Category.season_id == season_id, Category.code == code_new).first():
            raise HTTPException(400, f"Catégorie {code_new} déjà existante")
        cat = Category(
            club_id=club_id,
            season_id=season_id,
            discipline_id=disc.id,
            code=code_new,
            name=payload.category_name.strip(),
            name_ar=payload.category_name_ar,
            birth_year_min=payload.birth_year_min,
            birth_year_max=payload.birth_year_max,
            is_active=True,
        )
        db.add(cat)
        db.flush()

    assert cat is not None
    existing = db.query(Team).filter(Team.category_id == cat.id).order_by(Team.id).all()
    next_n = len(existing) + 1
    code = (payload.code or f"{cat.code}G{next_n}").strip().upper()
    name = (payload.name or f"{cat.code} Groupe {next_n}").strip()
    name_ar = payload.name_ar or f"{cat.code} مجموعة {next_n}"
    if db.query(Team).filter(Team.category_id == cat.id, Team.code == code).first():
        raise HTTPException(400, f"Équipe {code} déjà existante")

    team = Team(club_id=club_id, category_id=cat.id, name=name, name_ar=name_ar, code=code)
    db.add(team)
    db.flush()

    coach_ids = list(dict.fromkeys(payload.coach_ids or []))
    primary = payload.primary_coach_id or (coach_ids[0] if coach_ids else None)
    for uid in coach_ids:
        cu = db.get(User, uid)
        if not cu or cu.role not in TEAM_COACH_ROLES:
            continue
        db.add(
            TeamCoach(
                club_id=club_id,
                team_id=team.id,
                user_id=uid,
                role_label="primary" if uid == primary else "coach",
            )
        )

    write_audit(
        db,
        action="create",
        entity="team",
        entity_id=team.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"{code} cat={cat.code}",
    )
    db.commit()
    db.refresh(team)
    _bust_club_caches()
    return TeamOut.model_validate(team)


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

    season = _current_season(db, club_id)

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

    regs_q = db.query(func.count(Registration.id)).filter(Registration.status == "pending")
    parents_q = db.query(func.count(User.id)).filter(User.role == Role.PARENT)
    if club_id:
        regs_q = regs_q.filter(or_(Registration.club_id == club_id, Registration.club_id.is_(None)))
        parents_q = parents_q.filter(or_(User.club_id == club_id, User.club_id.is_(None)))
    regs_pending = regs_q.scalar() or 0
    parents = parents_q.scalar() or 0
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


def _month_keys(months: int = 12) -> list[tuple[int, int, str]]:
    """Liste (year, month, label) des N derniers mois, du plus ancien au plus récent."""
    today = date.today().replace(day=1)
    out: list[tuple[int, int, str]] = []
    y, m = today.year, today.month
    for _ in range(months):
        label = f"{month_abbr[m]} {str(y)[2:]}"
        out.append((y, m, label))
        m -= 1
        if m < 1:
            m = 12
            y -= 1
    out.reverse()
    return out


@router.get("/stats/analytics")
def club_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Séries pour tableaux de bord (barres, histogrammes, anneaux, secteurs, courbes)."""
    club_id = getattr(user, "club_id", None)
    cache_key = f"analytics:{club_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    def _ath(q):
        if club_id:
            return q.filter(or_(Athlete.club_id == club_id, Athlete.club_id.is_(None)))
        return q

    months = _month_keys(12)
    month_index = {(y, m): i for i, (y, m, _) in enumerate(months)}
    labels = [lab for _, _, lab in months]

    # --- Athlètes / categories (déjà dans stats, mais utile en standalone) ---
    by_status = {
        str(status or "—"): int(count)
        for status, count in _ath(db.query(Athlete.status, func.count(Athlete.id)))
        .group_by(Athlete.status)
        .all()
    }

    season = _current_season(db, club_id)
    categories: list[dict] = []
    if season:
        light = _ath(db.query(Athlete.birth_date)).all()
        for cat in (
            db.query(Category)
            .filter(Category.season_id == season.id)
            .order_by(Category.birth_year_min)
            .all()
        ):
            n = sum(
                1
                for (bdate,) in light
                if bdate and cat.birth_year_min <= bdate.year <= cat.birth_year_max
            )
            categories.append({"code": cat.code, "name": cat.name, "members": n})

    # --- Inscriptions par mois ---
    regs_series = [0] * len(months)
    reg_q = db.query(
        extract("year", Registration.created_at).label("y"),
        extract("month", Registration.created_at).label("m"),
        func.count(Registration.id),
    )
    if club_id:
        reg_q = reg_q.filter(or_(Registration.club_id == club_id, Registration.club_id.is_(None)))
    for y, m, cnt in reg_q.group_by("y", "m").all():
        idx = month_index.get((int(y), int(m)))
        if idx is not None:
            regs_series[idx] = int(cnt)

    # --- Paiements (montant) par mois ---
    payments_series = [0.0] * len(months)
    pay_q = db.query(
        extract("year", Payment.paid_on).label("y"),
        extract("month", Payment.paid_on).label("m"),
        func.coalesce(func.sum(Payment.amount), 0),
    )
    if club_id:
        pay_q = pay_q.filter(or_(Payment.club_id == club_id, Payment.club_id.is_(None)))
    for y, m, total in pay_q.group_by("y", "m").all():
        idx = month_index.get((int(y), int(m)))
        if idx is not None:
            payments_series[idx] = float(total or 0)

    # --- Caisse revenus / dépenses par mois ---
    income_series = [0.0] * len(months)
    expense_series = [0.0] * len(months)
    led_q = db.query(
        extract("year", LedgerEntry.entry_date).label("y"),
        extract("month", LedgerEntry.entry_date).label("m"),
        LedgerEntry.entry_type,
        func.coalesce(func.sum(LedgerEntry.amount), 0),
    ).filter(or_(LedgerEntry.is_archived.is_(False), LedgerEntry.is_archived.is_(None)))
    if club_id:
        led_q = led_q.filter(or_(LedgerEntry.club_id == club_id, LedgerEntry.club_id.is_(None)))
    for y, m, etype, total in led_q.group_by("y", "m", LedgerEntry.entry_type).all():
        idx = month_index.get((int(y), int(m)))
        if idx is None:
            continue
        if etype == "income":
            income_series[idx] = float(total or 0)
        elif etype == "expense":
            expense_series[idx] = float(total or 0)

    # --- Séances par mois + type ---
    events_series = [0] * len(months)
    events_by_type: dict[str, int] = {}
    ev_q = db.query(
        extract("year", Event.starts_at).label("y"),
        extract("month", Event.starts_at).label("m"),
        func.count(Event.id),
    ).filter(Event.is_cancelled.is_(False))
    if club_id:
        ev_q = ev_q.filter(or_(Event.club_id == club_id, Event.club_id.is_(None)))
    for y, m, cnt in ev_q.group_by("y", "m").all():
        idx = month_index.get((int(y), int(m)))
        if idx is not None:
            events_series[idx] = int(cnt)

    type_q = db.query(Event.event_type, func.count(Event.id)).filter(Event.is_cancelled.is_(False))
    if club_id:
        type_q = type_q.filter(or_(Event.club_id == club_id, Event.club_id.is_(None)))
    for etype, cnt in type_q.group_by(Event.event_type).all():
        events_by_type[str(etype or "other")] = int(cnt)

    # --- Présences ---
    attendance_by_status: dict[str, int] = {}
    att_q = db.query(Attendance.status, func.count(Attendance.id))
    if club_id:
        att_q = att_q.filter(or_(Attendance.club_id == club_id, Attendance.club_id.is_(None)))
    for st, cnt in att_q.group_by(Attendance.status).all():
        attendance_by_status[str(st or "—")] = int(cnt)

    # --- Échéances cotisations ---
    installments_by_status: dict[str, int] = {}
    inst_q = db.query(FeeInstallment.status, func.count(FeeInstallment.id))
    if club_id:
        inst_q = inst_q.filter(or_(FeeInstallment.club_id == club_id, FeeInstallment.club_id.is_(None)))
    for st, cnt in inst_q.group_by(FeeInstallment.status).all():
        installments_by_status[str(st or "—")] = int(cnt)

    # Courbe cumulée encaissements
    cumulative_payments: list[float] = []
    running = 0.0
    for v in payments_series:
        running += v
        cumulative_payments.append(round(running, 2))

    payload = {
        "currency": "DZD",
        "months": labels,
        "registrations_by_month": regs_series,
        "payments_by_month": [round(v, 2) for v in payments_series],
        "payments_cumulative": cumulative_payments,
        "ledger_income_by_month": [round(v, 2) for v in income_series],
        "ledger_expense_by_month": [round(v, 2) for v in expense_series],
        "events_by_month": events_series,
        "events_by_type": events_by_type,
        "athletes_by_status": by_status,
        "athletes_by_category": categories,
        "attendance_by_status": attendance_by_status,
        "installments_by_status": installments_by_status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    cache_set(cache_key, payload, 45)
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


_ARCHIVED_ATHLETE_STATUSES = {"Abandonne", "Left", "Inactif"}


def _next_kit_number(
    db: Session,
    *,
    season_id: int,
    category_id: int,
    club_id: int | None = None,
    exclude_reg_id: int | None = None,
) -> int:
    """Plus petit n° maillot/sac libre (réutilise les trous après archive/suppression)."""
    q = db.query(Registration.kit_number).filter(
        Registration.season_id == season_id,
        Registration.category_id == category_id,
        Registration.status != "archived",
        Registration.kit_number.isnot(None),
    )
    if club_id is not None:
        q = q.filter(or_(Registration.club_id == club_id, Registration.club_id.is_(None)))
    if exclude_reg_id:
        q = q.filter(Registration.id != exclude_reg_id)
    used = {int(n) for (n,) in q.all() if n is not None and int(n) > 0}
    n = 1
    while n in used:
        n += 1
    return n


def _kit_number_taken(
    db: Session,
    *,
    season_id: int,
    category_id: int,
    kit_number: int,
    exclude_reg_id: int | None = None,
    club_id: int | None = None,
) -> bool:
    q = db.query(Registration.id).filter(
        Registration.season_id == season_id,
        Registration.category_id == category_id,
        Registration.kit_number == kit_number,
        Registration.status != "archived",
    )
    if club_id is not None:
        q = q.filter(or_(Registration.club_id == club_id, Registration.club_id.is_(None)))
    if exclude_reg_id:
        q = q.filter(Registration.id != exclude_reg_id)
    return q.first() is not None


def _sync_membership_jersey(
    db: Session,
    *,
    athlete_id: int,
    season_id: int,
    category_id: int | None,
    kit_number: int | None,
    club_id: int | None = None,
    team_id: int | None = None,
) -> None:
    if kit_number is None:
        return
    team = db.get(Team, team_id) if team_id else None
    if not team and category_id:
        team = db.query(Team).filter(Team.category_id == category_id).order_by(Team.code.asc()).first()
    if not team:
        return
    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.athlete_id == athlete_id,
            TeamMembership.season_id == season_id,
        )
        .first()
    )
    if membership:
        membership.jersey_number = kit_number
        membership.team_id = team.id
    else:
        db.add(
            TeamMembership(
                club_id=club_id,
                team_id=team.id,
                athlete_id=athlete_id,
                season_id=season_id,
                jersey_number=kit_number,
            )
        )


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
    list_number: int | None = None,
    kit_number: int | None = None,
    registration_reference: str | None = None,
) -> AthleteOut:
    # Important : si parent_phone vient du bulk (même None), ne pas retomber en N+1
    phone = (
        _athlete_parent_phone(db, athlete.id) if parent_phone is _MISSING else parent_phone  # type: ignore[arg-type]
    )
    today = date.today()
    lic_until = getattr(athlete, "license_valid_until", None)
    med_until = getattr(athlete, "medical_cert_valid_until", None)
    lic_soon = bool(lic_until and 0 <= (lic_until - today).days <= 30)
    med_soon = bool(med_until and 0 <= (med_until - today).days <= 30)
    return AthleteOut(
        id=athlete.id,
        legacy_number=athlete.legacy_number,
        list_number=list_number,
        kit_number=kit_number,
        registration_reference=registration_reference,
        full_name=athlete.full_name,
        full_name_ar=athlete.full_name_ar,
        birth_date=athlete.birth_date,
        birth_place=athlete.birth_place,
        status=athlete.status,
        license_number=athlete.license_number,
        license_valid_until=lic_until,
        license_status=getattr(athlete, "license_status", None),
        medical_cert_date=getattr(athlete, "medical_cert_date", None),
        medical_cert_valid_until=med_until,
        license_expiring_soon=lic_soon,
        medical_expiring_soon=med_soon,
        notes=athlete.notes,
        photo_path=enrich_media_path(athlete.photo_path),
        blood_type=getattr(athlete, "blood_type", None),
        parent_phone=phone,  # type: ignore[arg-type]
        category_id=category_id,
        category_code=category_code,
    )


def _category_map_for_season(
    db: Session, season_id: int | None, club_id: int | None = None
) -> list[Category]:
    q = db.query(Category)
    if season_id:
        q = q.filter(Category.season_id == season_id)
    else:
        current = _current_season(db, club_id)
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
        current = _current_season(db, club_id)
        season = current.id if current else None
    cats = _category_map_for_season(db, season, club_id)

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
                Athlete.license_valid_until,
                Athlete.license_status,
                Athlete.medical_cert_date,
                Athlete.medical_cert_valid_until,
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
    if status == "all":
        pass  # tous statuts y compris archives
    elif status:
        query = query.filter(Athlete.status == status)
    else:
        # Par défaut : actifs uniquement — archives (Abandonne…) via filtre statut
        query = query.filter(~Athlete.status.in_(list(_ARCHIVED_ATHLETE_STATUSES)))
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
    athlete_ids = [a.id for a, _ in rows]
    last_pay: dict[int, tuple] = {}
    if athlete_ids:
        pay_rows = (
            db.query(Payment.athlete_id, func.max(Payment.paid_on), func.max(Payment.id))
            .filter(Payment.athlete_id.in_(athlete_ids))
            .group_by(Payment.athlete_id)
            .all()
        )
        # Récupérer le montant du dernier paiement (par id max du jour max)
        for aid, paid_on, _pid in pay_rows:
            last = (
                db.query(Payment)
                .filter(Payment.athlete_id == aid, Payment.paid_on == paid_on)
                .order_by(Payment.id.desc())
                .first()
            )
            if last:
                last_pay[aid] = (last.paid_on, last.amount)

    # N° joueur = même rang compact que Inscriptions (list_number), pas l'id base
    reg_by_athlete: dict[int, Registration] = {}
    list_numbers: dict[int, int] = {}
    if season and athlete_ids:
        regs = (
            db.query(Registration)
            .filter(
                Registration.athlete_id.in_(athlete_ids),
                Registration.season_id == season,
                Registration.status != "archived",
                or_(Registration.club_id == club_id, Registration.club_id.is_(None)),
            )
            .order_by(Registration.created_at.asc(), Registration.id.asc())
            .all()
        )
        for r in regs:
            if r.athlete_id not in reg_by_athlete:
                reg_by_athlete[r.athlete_id] = r
        list_numbers = _registration_list_numbers(db, club_id=club_id, season_ids={int(season)})

    out: list[AthleteOut] = []
    today = date.today()
    for athlete, phone in rows:
        cid, ccode = _cat_for_birth(cats, athlete.birth_date)
        lp = last_pay.get(athlete.id)
        reg = reg_by_athlete.get(athlete.id)
        lic_until = getattr(athlete, "license_valid_until", None)
        med_until = getattr(athlete, "medical_cert_valid_until", None)
        out.append(
            AthleteOut(
                id=athlete.id,
                legacy_number=athlete.legacy_number,
                list_number=list_numbers.get(reg.id) if reg else None,
                kit_number=getattr(reg, "kit_number", None) if reg else None,
                registration_reference=getattr(reg, "reference", None) if reg else None,
                full_name=athlete.full_name,
                full_name_ar=athlete.full_name_ar,
                birth_date=athlete.birth_date,
                birth_place=athlete.birth_place,
                status=athlete.status,
                license_number=athlete.license_number,
                license_valid_until=lic_until,
                license_status=getattr(athlete, "license_status", None),
                medical_cert_date=getattr(athlete, "medical_cert_date", None),
                medical_cert_valid_until=med_until,
                license_expiring_soon=bool(lic_until and 0 <= (lic_until - today).days <= 30),
                medical_expiring_soon=bool(med_until and 0 <= (med_until - today).days <= 30),
                notes=None,
                photo_path=enrich_media_path(athlete.photo_path),
                blood_type=getattr(athlete, "blood_type", None),
                parent_phone=phone,
                category_id=cid,
                category_code=ccode,
                last_payment_on=lp[0] if lp else None,
                last_payment_amount=lp[1] if lp else None,
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
                club_id=club_id,
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


@athletes_router.get("/archive-lookup")
def archive_lookup(
    full_name: str = Query(..., min_length=2),
    birth_date: date = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
    club_id: int = Depends(get_current_club_id),
):
    """Propose la reprise d'un joueur déjà en archive (même nom + date de naissance).
    Les infos identité sont renvoyées ; téléphone parent et catégorie restent à saisir manuellement."""
    athlete = _find_duplicate_athlete(db, full_name, birth_date)
    if not athlete:
        return {"found": False}
    assert_same_club(athlete, club_id)
    if user.role == Role.PARENT and athlete.id not in _parent_athlete_ids(db, user):
        # Parent : seulement si déjà lié, sinon on laisse créer (pas d'info archive)
        link = db.query(ParentChild).filter_by(parent_id=user.id, athlete_id=athlete.id).first()
        if not link and athlete.status not in _ARCHIVED_ATHLETE_STATUSES:
            return {"found": False}
    last_reg = (
        db.query(Registration)
        .filter(
            Registration.athlete_id == athlete.id,
            or_(Registration.club_id == club_id, Registration.club_id.is_(None)),
        )
        .order_by(Registration.id.desc())
        .first()
    )
    last_cat = db.get(Category, last_reg.category_id) if last_reg and last_reg.category_id else None
    return {
        "found": True,
        "from_archive": athlete.status in _ARCHIVED_ATHLETE_STATUSES,
        "athlete": {
            "id": athlete.id,
            "full_name": athlete.full_name,
            "birth_date": athlete.birth_date.isoformat() if athlete.birth_date else None,
            "birth_place": athlete.birth_place,
            "blood_type": getattr(athlete, "blood_type", None),
            "photo_path": enrich_media_path(athlete.photo_path),
            "status": athlete.status,
            # Hint seulement — UI ne doit PAS préremplir le téléphone (saisie manuelle)
            "previous_parent_phone_hint": _athlete_parent_phone(db, athlete.id),
            "previous_category_code": last_cat.code if last_cat else None,
            "previous_season_id": last_reg.season_id if last_reg else None,
        },
    }


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

    if "photo_path" in data and data["photo_path"]:
        mid = extract_media_id(data["photo_path"])
        if mid:
            data["photo_path"] = media_public_path(mid)

    for k, v in data.items():
        setattr(athlete, k, v)

    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
                club_id=club_id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    if new_status and new_status in {"Abandonne", "Left", "Inactif"}:
        note = payload.notes or athlete.notes or ""
        title = f"Joueur — {athlete.full_name}"
        body = f"Statut mis à jour : {new_status}. {note}".strip()
        notify_parents_of_athlete(db, athlete.id, title, body, kind="status")
        notify_role(db, Role.ADMIN, title, body, kind="status", club_id=club_id)

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
    """Soft-delete : statut Abandonne — récupérable via Historique / restore."""
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)
    prev = athlete.status
    athlete.status = "Abandonne"
    if not (athlete.notes or "").strip():
        athlete.notes = "Supprimé (récupérable depuis l'historique)"
    write_audit(
        db,
        action="delete",
        entity="athlete",
        entity_id=athlete_id,
        user_id=user.id,
        club_id=club_id,
        detail=f"{athlete.full_name} from={prev}",
    )
    db.commit()
    _bust_club_caches()
    return {"deleted": athlete_id, "soft": True, "status": "Abandonne"}


@athletes_router.post("/{athlete_id}/restore", response_model=AthleteOut)
def restore_athlete(
    athlete_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Restaure un joueur archivé / soft-supprimé → Active."""
    athlete = db.get(Athlete, athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)
    athlete.status = "Active"
    write_audit(
        db,
        action="restore",
        entity="athlete",
        entity_id=athlete.id,
        user_id=user.id,
        club_id=club_id,
        detail=athlete.full_name,
    )
    db.commit()
    db.refresh(athlete)
    _bust_club_caches()
    return _to_athlete_out(db, athlete)


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


def _registration_list_numbers(
    db: Session,
    *,
    club_id: int,
    season_ids: set[int] | None = None,
) -> dict[int, int]:
    """Rangs compacts 1..N des dossiers actifs, par saison et par ancienneté."""
    q = db.query(Registration.id, Registration.season_id).filter(
        or_(Registration.club_id == club_id, Registration.club_id.is_(None)),
        Registration.status != "archived",
    )
    if season_ids:
        q = q.filter(Registration.season_id.in_(season_ids))
    rows = q.order_by(
        Registration.season_id.asc(),
        Registration.created_at.asc(),
        Registration.id.asc(),
    ).all()
    counters: dict[int, int] = {}
    result: dict[int, int] = {}
    for reg_id, sid in rows:
        counters[sid] = counters.get(sid, 0) + 1
        result[reg_id] = counters[sid]
    return result


def _registration_list_number(db: Session, reg: Registration, club_id: int) -> int | None:
    if reg.status == "archived":
        return None
    return _registration_list_numbers(
        db, club_id=club_id, season_ids={reg.season_id}
    ).get(reg.id)


def _reg_out_from_maps(
    reg: Registration,
    athletes: dict[int, Athlete],
    categories: dict[int, Category],
    phones: dict[int, str | None],
    parent_meta: dict | None = None,
    teams: dict[int, Team] | None = None,
    list_number: int | None = None,
) -> RegistrationOut:
    athlete = athletes.get(reg.athlete_id)
    cat = categories.get(reg.category_id) if reg.category_id else None
    team = (teams or {}).get(reg.team_id) if getattr(reg, "team_id", None) else None
    return RegistrationOut(
        id=reg.id,
        list_number=list_number,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        team_id=getattr(reg, "team_id", None),
        team_code=team.code if team else None,
        team_name=team.name if team else None,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        notes=getattr(reg, "notes", None),
        seq_no=getattr(reg, "seq_no", None),
        reference=getattr(reg, "reference", None),
        kit_number=getattr(reg, "kit_number", None),
        has_jersey=bool(getattr(reg, "has_jersey", False)),
        has_backpack=bool(getattr(reg, "has_backpack", False)),
        kit_size=getattr(reg, "kit_size", None),
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        birth_date=athlete.birth_date if athlete else None,
        birth_place=athlete.birth_place if athlete else None,
        blood_type=getattr(athlete, "blood_type", None) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=phones.get(reg.athlete_id),
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
        created_at=getattr(reg, "created_at", None),
    )


def _reg_out(db: Session, reg: Registration, parent_meta: dict | None = None) -> RegistrationOut:
    athlete = db.get(Athlete, reg.athlete_id)
    cat = db.get(Category, reg.category_id) if reg.category_id else None
    team = db.get(Team, reg.team_id) if getattr(reg, "team_id", None) else None
    parent_phone = _athlete_parent_phone(db, reg.athlete_id)
    return RegistrationOut(
        id=reg.id,
        list_number=_registration_list_number(db, reg, int(reg.club_id or 0)),
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        team_id=getattr(reg, "team_id", None),
        team_code=team.code if team else None,
        team_name=team.name if team else None,
        registered_on=reg.registered_on,
        status=reg.status,
        source=reg.source,
        subscription_fee=reg.subscription_fee,
        notes=getattr(reg, "notes", None),
        seq_no=getattr(reg, "seq_no", None),
        reference=getattr(reg, "reference", None),
        kit_number=getattr(reg, "kit_number", None),
        has_jersey=bool(getattr(reg, "has_jersey", False)),
        has_backpack=bool(getattr(reg, "has_backpack", False)),
        kit_size=getattr(reg, "kit_size", None),
        athlete_name=athlete.full_name if athlete else None,
        athlete_photo=enrich_media_path(athlete.photo_path) if athlete else None,
        birth_date=athlete.birth_date if athlete else None,
        birth_place=athlete.birth_place if athlete else None,
        blood_type=getattr(athlete, "blood_type", None) if athlete else None,
        category_code=cat.code if cat else None,
        parent_phone=parent_phone,
        parent_temp_password=(parent_meta or {}).get("temp_password"),
        parent_created=(parent_meta or {}).get("created"),
        created_at=getattr(reg, "created_at", None),
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
    # "number" (N° joueur / list_number) is computed after fetch — order by creation for stable base.
    if sort == "name":
        q = q.outerjoin(Athlete, Athlete.id == Registration.athlete_id)
        name_col = Athlete.full_name
        order_expr = name_col.desc() if desc else name_col.asc()
    else:
        sort_cols = {
            "recent": Registration.id,
            "date": Registration.created_at,
            "status": Registration.status,
            "category": Registration.category_id,
            "number": Registration.created_at,
            "kit": Registration.kit_number,
            "reference": Registration.reference,
        }
        col = sort_cols.get(sort, Registration.created_at if sort == "number" else Registration.id)
        order_expr = col.desc() if desc else col.asc()
    try:
        order_expr = order_expr.nullslast()
    except Exception:
        pass
    # For list_number sort we need the full season set then paginate in memory.
    if sort == "number":
        rows_all = q.order_by(Registration.created_at.asc(), Registration.id.asc()).all()
    else:
        rows_all = q.order_by(order_expr, Registration.id.desc()).offset(skip).limit(limit).all()
    if not rows_all:
        cache_set(cache_key, [], 25)
        return []
    athlete_ids = list({r.athlete_id for r in rows_all})
    cat_ids = list({r.category_id for r in rows_all if r.category_id})
    team_ids = list({r.team_id for r in rows_all if getattr(r, "team_id", None)})
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()}
    categories = (
        {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
    )
    teams = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()} if team_ids else {}
    phones = _bulk_parent_phones(db, athlete_ids)
    active_seasons = {r.season_id for r in rows_all if r.status != "archived"}
    list_numbers = _registration_list_numbers(
        db, club_id=club_id, season_ids=active_seasons
    ) if active_seasons else {}
    out = [
        _reg_out_from_maps(
            r,
            athletes,
            categories,
            phones,
            teams=teams,
            list_number=list_numbers.get(r.id),
        )
        for r in rows_all
    ]
    if sort == "number":
        out.sort(
            key=lambda r: (
                r.list_number is None,
                r.list_number if r.list_number is not None else 0,
                r.id,
            ),
            reverse=desc,
        )
        out = out[skip : skip + limit]
    cache_set(cache_key, out, 25)
    return out


@reg_router.get("/next-kit-number")
def next_kit_number(
    season_id: int = Query(...),
    category_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.PARENT)),
    club_id: int = Depends(get_current_club_id),
):
    """Prochain n° maillot/sac pour la catégorie (à imprimer sur équipement + sac)."""
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "Catégorie introuvable")
    if cat.season_id != season_id:
        raise HTTPException(400, "Catégorie hors saison")
    n = _next_kit_number(db, season_id=season_id, category_id=category_id, club_id=club_id)
    return {
        "season_id": season_id,
        "category_id": category_id,
        "category_code": cat.code,
        "next_kit_number": n,
    }


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
        elif athlete_id:
            # Réinscription explicite (archive) : ne pas créer un second dossier joueur
            existing = db.get(Athlete, athlete_id)
            if not existing:
                raise HTTPException(400, "Athlète archive introuvable")
            birth = existing.birth_date or payload.athlete.birth_date
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
    # Réinscription depuis archive → réactiver le joueur
    if athlete.status in _ARCHIVED_ATHLETE_STATUSES:
        athlete.status = "Active"

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
                club_id=club_id,
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

    # N° équipement (maillot + sac) — auto si non fourni (plus petit libre)
    kit_number = payload.kit_number
    if kit_number is None and category_id:
        kit_number = _next_kit_number(
            db, season_id=payload.season_id, category_id=category_id, club_id=club_id
        )
    elif kit_number is not None and category_id:
        if kit_number < 1:
            raise HTTPException(400, "Numéro d'équipement invalide")
        if _kit_number_taken(
            db,
            season_id=payload.season_id,
            category_id=category_id,
            kit_number=kit_number,
            club_id=club_id,
        ):
            raise HTTPException(
                409,
                f"Le numéro {kit_number} est déjà pris dans cette catégorie pour la saison.",
            )

    team_id = payload.team_id
    if team_id:
        team_obj = db.get(Team, team_id)
        if not team_obj:
            raise HTTPException(400, "Groupe / équipe introuvable")
        if category_id and team_obj.category_id != category_id:
            raise HTTPException(400, "Groupe hors catégorie sélectionnée")
    elif category_id:
        # Auto : Groupe 1 si un seul choix ou G1 par défaut
        team_obj = (
            db.query(Team)
            .filter(Team.category_id == category_id)
            .order_by(Team.code.asc())
            .first()
        )
        team_id = team_obj.id if team_obj else None

    reg = Registration(
        club_id=club_id,
        athlete_id=athlete_id,
        season_id=payload.season_id,
        category_id=category_id,
        team_id=team_id,
        registered_on=payload.registered_on or date.today(),
        status="pending" if user.role == Role.PARENT else "approved",
        source=payload.source or ("mobile" if user.role == Role.PARENT else "web"),
        subscription_fee=payload.subscription_fee,
        kit_number=kit_number,
        has_jersey=bool(payload.has_jersey),
        has_backpack=bool(payload.has_backpack),
        kit_size=payload.kit_size,
    )
    from app.services.references import assign_registration_identity

    db.add(reg)
    db.flush()  # id permanent utilisé dans la référence immuable
    assign_registration_identity(
        db,
        reg,
        club_id=club_id,
        season=season,
        category=cat,
    )
    db.flush()

    if category_id and reg.status == "approved":
        team = db.get(Team, team_id) if team_id else db.query(Team).filter(Team.category_id == category_id).first()
        if team and not db.query(TeamMembership).filter_by(
            team_id=team.id, athlete_id=athlete_id, season_id=payload.season_id
        ).first():
            db.add(
                TeamMembership(
                    club_id=club_id,
                    team_id=team.id,
                    athlete_id=athlete_id,
                    season_id=payload.season_id,
                    jersey_number=kit_number,
                )
            )
        else:
            _sync_membership_jersey(
                db,
                athlete_id=athlete_id,
                season_id=payload.season_id,
                category_id=category_id,
                kit_number=kit_number,
                club_id=club_id,
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
                TeamMembership(
                    club_id=club_id,
                    team_id=team.id,
                    athlete_id=reg.athlete_id,
                    season_id=reg.season_id,
                    jersey_number=getattr(reg, "kit_number", None),
                )
            )
        else:
            _sync_membership_jersey(
                db,
                athlete_id=reg.athlete_id,
                season_id=reg.season_id,
                category_id=reg.category_id,
                kit_number=getattr(reg, "kit_number", None),
                club_id=club_id,
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


@reg_router.patch("/{reg_id}", response_model=RegistrationOut)
def update_registration(
    reg_id: int,
    payload: RegistrationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Modifie un dossier d'inscription et les infos athlète liées."""
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    athlete = db.get(Athlete, reg.athlete_id)
    if not athlete:
        raise HTTPException(404, "Athlète introuvable")
    assert_same_club(athlete, club_id)

    data = payload.model_dump(exclude_unset=True)
    allowed_status = {"pending", "approved", "rejected", "archived"}
    if "status" in data and data["status"] not in allowed_status:
        raise HTTPException(400, f"Statut invalide (attendu: {', '.join(sorted(allowed_status))})")

    new_cat_id = data.get("category_id", reg.category_id)
    cat: Category | None = db.get(Category, new_cat_id) if new_cat_id else None
    if new_cat_id and not cat:
        raise HTTPException(400, "Catégorie introuvable")
    if cat and cat.season_id != reg.season_id:
        raise HTTPException(400, "Catégorie hors saison de l'inscription")

    birth = data.get("birth_date", athlete.birth_date)
    try:
        if "birth_date" in data or "category_id" in data:
            validate_club_age(birth, required=True)
            if cat:
                validate_category_for_birth(birth, cat)
        if payload.parent_phone:
            validate_dz_mobile(payload.parent_phone, required=True)
        if "blood_type" in data:
            data["blood_type"] = validate_blood_type(data.get("blood_type"))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    for field in ("category_id", "subscription_fee", "notes", "registered_on", "status", "team_id"):
        if field in data:
            setattr(reg, field, data[field])

    if "team_id" in data and data["team_id"]:
        team_obj = db.get(Team, data["team_id"])
        if not team_obj:
            raise HTTPException(400, "Groupe introuvable")
        if reg.category_id and team_obj.category_id != reg.category_id:
            raise HTTPException(400, "Groupe hors catégorie")
        # Déplacer membership
        mem = (
            db.query(TeamMembership)
            .filter(
                TeamMembership.athlete_id == athlete.id,
                TeamMembership.season_id == reg.season_id,
            )
            .first()
        )
        if mem:
            mem.team_id = team_obj.id
        else:
            db.add(
                TeamMembership(
                    club_id=club_id,
                    team_id=team_obj.id,
                    athlete_id=athlete.id,
                    season_id=reg.season_id,
                    jersey_number=reg.kit_number,
                )
            )

    # Kit / équipement
    cat_id_for_kit = reg.category_id
    if "kit_number" in data or "category_id" in data:
        kn = data.get("kit_number", reg.kit_number)
        if kn is None and cat_id_for_kit:
            kn = _next_kit_number(
                db,
                season_id=reg.season_id,
                category_id=cat_id_for_kit,
                club_id=club_id,
                exclude_reg_id=reg.id,
            )
        if kn is not None:
            if int(kn) < 1:
                raise HTTPException(400, "Numéro d'équipement invalide")
            if cat_id_for_kit and _kit_number_taken(
                db,
                season_id=reg.season_id,
                category_id=cat_id_for_kit,
                kit_number=int(kn),
                exclude_reg_id=reg.id,
                club_id=club_id,
            ):
                raise HTTPException(
                    409,
                    f"Le numéro {kn} est déjà pris dans cette catégorie pour la saison.",
                )
            reg.kit_number = int(kn)
            _sync_membership_jersey(
                db,
                athlete_id=athlete.id,
                season_id=reg.season_id,
                category_id=cat_id_for_kit,
                kit_number=reg.kit_number,
                club_id=club_id,
            )
    if "has_jersey" in data:
        reg.has_jersey = bool(data["has_jersey"])
    if "has_backpack" in data:
        reg.has_backpack = bool(data["has_backpack"])
    if "kit_size" in data:
        reg.kit_size = data["kit_size"]

    for field in ("full_name", "birth_date", "birth_place", "photo_path", "blood_type"):
        if field in data:
            val = data[field]
            if field == "photo_path" and val:
                mid = extract_media_id(val)
                if mid:
                    val = media_public_path(mid)
            setattr(athlete, field, val)

    if payload.parent_phone:
        try:
            ensure_parent_account(
                db,
                phone=payload.parent_phone,
                full_name=payload.parent_name,
                athlete_id=athlete.id,
                club_id=club_id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    write_audit(
        db,
        action="update",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"athlete={athlete.id} status={reg.status} cat={reg.category_id}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


@reg_router.delete("/{reg_id}")
def delete_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
    club_id: int = Depends(get_current_club_id),
):
    """Soft-delete d'un dossier = archive — récupérable via restore / Historique."""
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)
    athlete_name = None
    athlete = db.get(Athlete, reg.athlete_id)
    if athlete:
        athlete_name = athlete.full_name
    prev = reg.status
    reg.status = "archived"
    freed = reg.kit_number
    from app.services.references import release_registration_identity

    release_registration_identity(reg)
    detail = (
        f"athlete={reg.athlete_id} name={athlete_name or '?'} "
        f"from={prev} freed_kit={freed} reference_preserved={reg.reference}"
    )
    write_audit(
        db,
        action="delete",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=detail,
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return {
        "deleted": reg_id,
        "soft": True,
        "status": "archived",
        "freed_kit_number": freed,
        "reference": reg.reference,
    }


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
    freed = reg.kit_number
    from app.services.references import release_registration_identity

    release_registration_identity(reg)
    write_audit(
        db,
        action="archive",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=(
            f"from={prev} athlete={reg.athlete_id} freed_kit={freed} "
            f"reference_preserved={reg.reference}"
        ),
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
        detail=f"athlete={reg.athlete_id} reference={reg.reference}",
    )
    db.commit()
    db.refresh(reg)
    _bust_club_caches()
    return _reg_out(db, reg)


def _find_stock_item(db: Session, club_id: int, kind: str) -> InventoryItem | None:
    """Trouve un article en stock par type (jersey/backpack) avec quantité > 0."""
    item = (
        db.query(InventoryItem)
        .filter(
            or_(InventoryItem.club_id == club_id, InventoryItem.club_id.is_(None)),
            InventoryItem.item_kind == kind,
            InventoryItem.quantity > 0,
        )
        .order_by(InventoryItem.id.asc())
        .first()
    )
    if item:
        return item
    # Fallback nom fr/ar
    keywords = {
        "jersey": ["maillot", "jersey", "tenue", "kit"],
        "backpack": ["sac", "backpack", "cartable"],
    }
    for kw in keywords.get(kind, []):
        item = (
            db.query(InventoryItem)
            .filter(
                or_(InventoryItem.club_id == club_id, InventoryItem.club_id.is_(None)),
                InventoryItem.quantity > 0,
                func.lower(InventoryItem.name).like(f"%{kw}%"),
            )
            .first()
        )
        if item:
            return item
    return None


@reg_router.post("/{reg_id}/deliver-kit", response_model=RegistrationOut)
def deliver_kit(
    reg_id: int,
    give_jersey: bool = True,
    give_backpack: bool = True,
    kit_number: int | None = None,
    kit_size: str | None = None,
    jersey_item_id: int | None = None,
    backpack_item_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF)),
    club_id: int = Depends(get_current_club_id),
):
    """Remet maillot et/ou sac au joueur : décrémente le stock, marque l'inscription,
    synchronise le n° (imprimé maillot + sac)."""
    reg = db.get(Registration, reg_id)
    if not reg:
        raise HTTPException(404, "Inscription introuvable")
    assert_same_club(reg, club_id)

    if kit_number is not None:
        if kit_number < 1:
            raise HTTPException(400, "Numéro d'équipement invalide")
        if reg.category_id and _kit_number_taken(
            db,
            season_id=reg.season_id,
            category_id=reg.category_id,
            kit_number=kit_number,
            exclude_reg_id=reg.id,
            club_id=club_id,
        ):
            raise HTTPException(409, f"Le numéro {kit_number} est déjà pris dans cette catégorie.")
        reg.kit_number = kit_number
    elif reg.kit_number is None and reg.category_id:
        reg.kit_number = _next_kit_number(
            db, season_id=reg.season_id, category_id=reg.category_id, club_id=club_id
        )
    if kit_size is not None:
        reg.kit_size = kit_size

    def _assign(kind: str, item_id: int | None, already: bool) -> bool:
        if already:
            return True
        item = db.get(InventoryItem, item_id) if item_id else _find_stock_item(db, club_id, kind)
        if not item:
            raise HTTPException(
                400,
                f"Stock insuffisant pour {'maillot' if kind == 'jersey' else 'sac'} — "
                f"ajoutez un achat dans Matériel (type {kind}).",
            )
        assert_same_club(item, club_id)
        if item.quantity < 1:
            raise HTTPException(400, f"Stock épuisé : {item.name}")
        item.quantity -= 1
        db.add(
            InventoryAssignment(
                club_id=club_id,
                item_id=item.id,
                athlete_id=reg.athlete_id,
                user_id=user.id,
                quantity=1,
                assigned_on=date.today(),
                season_id=reg.season_id,
                notes=f"kit#{reg.kit_number or '?'} {kind}",
            )
        )
        return True

    if give_jersey:
        reg.has_jersey = _assign("jersey", jersey_item_id, bool(reg.has_jersey))
    if give_backpack:
        reg.has_backpack = _assign("backpack", backpack_item_id, bool(reg.has_backpack))

    _sync_membership_jersey(
        db,
        athlete_id=reg.athlete_id,
        season_id=reg.season_id,
        category_id=reg.category_id,
        kit_number=reg.kit_number,
        club_id=club_id,
    )
    write_audit(
        db,
        action="deliver_kit",
        entity="registration",
        entity_id=reg.id,
        user_id=user.id,
        club_id=club_id,
        detail=f"kit={reg.kit_number} jersey={reg.has_jersey} backpack={reg.has_backpack}",
    )
    db.commit()
    db.refresh(reg)
    cache_delete_prefix("inventory:")
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
