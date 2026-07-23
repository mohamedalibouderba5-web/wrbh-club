#!/usr/bin/env python3
"""
Rotation des mots de passe démo (admin / coaches / parent@wrbh.local).

Usage:
  set ADMIN_NEW_PASSWORD=...
  set COACH_NEW_PASSWORD=...
  set PARENT_DEMO_NEW_PASSWORD=...
  python scripts/rotate_demo_passwords.py

Ne pas committer les mots de passe. En production, forcer via variables d'env.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal  # noqa: E402
from app.core.roles import Role  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import User  # noqa: E402

WEAK = {"admin123", "coach123", "parent123", "password", "123456"}


def main() -> int:
    admin_pw = os.environ.get("ADMIN_NEW_PASSWORD", "").strip()
    coach_pw = os.environ.get("COACH_NEW_PASSWORD", "").strip()
    parent_pw = os.environ.get("PARENT_DEMO_NEW_PASSWORD", "").strip()
    if not any([admin_pw, coach_pw, parent_pw]):
        print("Définir au moins ADMIN_NEW_PASSWORD / COACH_NEW_PASSWORD / PARENT_DEMO_NEW_PASSWORD")
        return 1
    for label, pw in (("admin", admin_pw), ("coach", coach_pw), ("parent", parent_pw)):
        if pw and (len(pw) < 8 or pw.lower() in WEAK):
            print(f"Mot de passe {label} trop faible")
            return 1

    db = SessionLocal()
    updated = []
    try:
        if admin_pw:
            for u in db.query(User).filter(User.role == Role.ADMIN).all():
                u.password_hash = hash_password(admin_pw)
                updated.append(f"admin:{u.email or u.id}")
        if coach_pw:
            for u in db.query(User).filter(User.role == Role.COACH).all():
                u.password_hash = hash_password(coach_pw)
                updated.append(f"coach:{u.email or u.id}")
        if parent_pw:
            u = db.query(User).filter(User.email == "parent@wrbh.local").first()
            if u:
                u.password_hash = hash_password(parent_pw)
                updated.append("parent@wrbh.local")
        db.commit()
        print("updated:", ", ".join(updated) or "(rien)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
