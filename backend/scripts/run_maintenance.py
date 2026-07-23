#!/usr/bin/env python3
"""
Maintenance prod (Aiven) : rotation mdp + backfill cotisations + purge TEST/VERIFY + prune teams.

Usage (depuis backend/) :
  # charge .env.aiven automatiquement s'il existe
  python scripts/run_maintenance.py
"""
from __future__ import annotations

import os
import secrets
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# load .env.aiven without printing
env_file = ROOT / ".env.aiven"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# Prefer WRBH DB if named DATABASE_URL
os.environ.setdefault("ENVIRONMENT", "production")

from app.core.config import get_settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.roles import Role  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Announcement,
    Athlete,
    Attendance,
    Category,
    Convocation,
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
from app.services.fees import ensure_subscription_installment  # noqa: E402

get_settings.cache_clear()


def gen_password(n: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    return "Wr!" + "".join(secrets.choice(alphabet) for _ in range(n - 3))


def rotate_passwords(db) -> dict:
    admin_pw = os.environ.get("ADMIN_NEW_PASSWORD") or gen_password()
    coach_pw = os.environ.get("COACH_NEW_PASSWORD") or gen_password()
    parent_pw = os.environ.get("PARENT_DEMO_NEW_PASSWORD") or gen_password()
    updated = {"admin": admin_pw, "coach": coach_pw, "parent_demo": parent_pw, "accounts": []}
    for u in db.query(User).filter(User.role == Role.ADMIN).all():
        u.password_hash = hash_password(admin_pw)
        updated["accounts"].append(f"admin:{u.email}")
    for u in db.query(User).filter(User.role == Role.COACH).all():
        u.password_hash = hash_password(coach_pw)
        updated["accounts"].append(f"coach:{u.email}")
    u = db.query(User).filter(User.email == "parent@wrbh.local").first()
    if u:
        u.password_hash = hash_password(parent_pw)
        updated["accounts"].append("parent@wrbh.local")
    return updated


def backfill_fees(db) -> dict:
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
    return {"registrations": len(regs), "installments_created": created}


def purge_tests(db) -> dict:
    athletes = (
        db.query(Athlete)
        .filter(
            (Athlete.full_name.contains("[TEST]"))
            | (Athlete.full_name.contains("[VERIFY]"))
            | (Athlete.notes.contains("TEST-WRBH-BATCH"))
            | (Athlete.notes.contains("VERIFY"))
        )
        .all()
    )
    ids = [a.id for a in athletes]
    events_deleted = 0
    for ev in db.query(Event).filter(
        (Event.title.contains("TEST-WRBH-BATCH")) | (Event.title.contains("[VERIFY]")) | (Event.title.contains("[TEST]"))
    ).all():
        db.query(Attendance).filter(Attendance.event_id == ev.id).delete(synchronize_session=False)
        db.query(Convocation).filter(Convocation.event_id == ev.id).delete(synchronize_session=False)
        db.delete(ev)
        events_deleted += 1
    for athlete_id in ids:
        for model in (
            Attendance,
            Convocation,
            FeeInstallment,
            Payment,
            TeamMembership,
            ParentChild,
            EmergencyContact,
            Registration,
        ):
            db.query(model).filter(getattr(model, "athlete_id") == athlete_id).delete(synchronize_session=False)
        ath = db.get(Athlete, athlete_id)
        if ath:
            db.delete(ath)
    parents = db.query(User).filter(User.role == Role.PARENT, User.phone.like("069911%")).all()
    parent_ids = [p.id for p in parents]
    if parent_ids:
        db.query(Notification).filter(Notification.user_id.in_(parent_ids)).delete(synchronize_session=False)
        db.query(ParentChild).filter(ParentChild.parent_id.in_(parent_ids)).delete(synchronize_session=False)
    for p in parents:
        db.delete(p)
    anns = 0
    for a in db.query(Announcement).filter(
        (Announcement.title.contains("TEST-WRBH-BATCH")) | (Announcement.title.contains("[TEST]"))
    ).all():
        db.delete(a)
        anns += 1
    return {
        "athletes_deleted": len(ids),
        "events_deleted": events_deleted,
        "parents_deleted": len(parent_ids),
        "announcements_deleted": anns,
    }


def prune_teams(db) -> dict:
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        return {"error": "no current season"}
    keep = {c.id for c in db.query(Category).filter(Category.season_id == season.id)}
    deleted = []
    for team in db.query(Team).all():
        if team.category_id in keep:
            continue
        active = (
            db.query(TeamMembership)
            .filter(TeamMembership.team_id == team.id, TeamMembership.is_active.is_(True))
            .count()
        )
        if active:
            continue
        db.query(Event).filter(Event.team_id == team.id).update({Event.team_id: None}, synchronize_session=False)
        db.query(TeamCoach).filter(TeamCoach.team_id == team.id).delete(synchronize_session=False)
        db.query(TeamMembership).filter(TeamMembership.team_id == team.id).delete(synchronize_session=False)
        deleted.append(team.name)
        db.delete(team)
    return {"season": season.name, "deleted_teams": deleted}


def main() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        pw = rotate_passwords(db)
        fees = backfill_fees(db)
        purge = purge_tests(db)
        teams = prune_teams(db)
        db.commit()

        out = ROOT / ".credentials.rotated"
        out.write_text(
            "\n".join(
                [
                    "# Generated by run_maintenance.py — DO NOT COMMIT",
                    f"ADMIN_EMAIL=admin@wrbh.local",
                    f"ADMIN_PASSWORD={pw['admin']}",
                    f"COACH_PASSWORD={pw['coach']}",
                    f"PARENT_DEMO_EMAIL=parent@wrbh.local",
                    f"PARENT_DEMO_PASSWORD={pw['parent_demo']}",
                    f"ACCOUNTS={','.join(pw['accounts'])}",
                    f"FEES={fees}",
                    f"PURGE={purge}",
                    f"TEAMS={teams}",
                ]
            ),
            encoding="utf-8",
        )
        print("OK maintenance")
        print("fees:", fees)
        print("purge:", purge)
        print("teams:", teams)
        print("credentials written to backend/.credentials.rotated (gitignored)")
        return 0
    except Exception as exc:
        db.rollback()
        print("FAIL", exc)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
