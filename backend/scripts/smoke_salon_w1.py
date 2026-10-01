"""Recette stand W-1 / W-2 — parcours démo VPS (sans domaine).

Usage:
  python backend/scripts/smoke_salon_w1.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

BASE = os.environ.get("WRBH_BASE", "http://46.224.38.201:8081").rstrip("/")
DEMO_PASSWORD = "DemoClub!2026"
SLUGS = ("demo-judo-978", "demo-foot-safex", "demo-multi-safex", "demo-hand-safex")


def _req(method: str, path: str, token: str | None = None, data: dict | None = None, form: dict | None = None):
    url = f"{BASE}{path}"
    headers = {"Accept": "application/json"}
    body = None
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw
        return e.code, detail


def login(slug: str, email: str | None = None, password: str = DEMO_PASSWORD) -> str:
    user = email or f"admin@{slug}.test"
    code, data = _req(
        "POST",
        "/api/v1/auth/login",
        form={"username": user, "password": password, "club_slug": slug},
    )
    if code != 200:
        raise RuntimeError(f"{code} {data}")
    return data["access_token"]


def main() -> int:
    print("BASE", BASE)
    code, health = _req("GET", "/health")
    print("HEALTH", code, health.get("git_sha") if isinstance(health, dict) else health)
    if code != 200:
        return 1

    code, clubs = _req("GET", "/api/v1/club/list")
    print("CLUB_LIST", code, [c.get("slug") for c in (clubs or [])])

    ok_logins: list[str] = []
    tokens: dict[str, str] = {}
    for slug in SLUGS:
        emails = [f"admin@{slug}.test"]
        if slug == "demo-judo-978":
            emails += ["admin@demo-judo-978.test", "admin@nadi-connect.local"]
        pwds = [DEMO_PASSWORD, "admin123", "DemoClub!2026"]
        done = False
        for email in emails:
            for pwd in pwds:
                try:
                    tok = login(slug, email, pwd)
                    tokens[slug] = tok
                    ok_logins.append(slug)
                    print("LOGIN_OK", slug, email)
                    done = True
                    break
                except Exception:
                    continue
            if done:
                break
        if not done:
            print("LOGIN_FAIL", slug)

    # W-1 on demo-foot-safex
    slug = "demo-foot-safex"
    if slug not in tokens:
        print("W1_FAIL no token")
        return 1
    token = tokens[slug]

    code, seasons = _req("GET", "/api/v1/seasons", token=token)
    season_id = None
    if isinstance(seasons, list) and seasons:
        cur = next((s for s in seasons if s.get("is_current")), seasons[0])
        season_id = cur["id"]
    print("SEASON", code, season_id)

    code, cats = _req("GET", "/api/v1/categories", token=token)
    cat = None
    if isinstance(cats, list) and cats:
        cat = next(
            (c for c in cats if c.get("birth_year_min") and c.get("birth_year_max")),
            cats[0],
        )
    cat_id = cat["id"] if cat else None
    by = (
        (int(cat["birth_year_min"]) + int(cat["birth_year_max"])) // 2
        if cat and cat.get("birth_year_min") is not None
        else 2010
    )
    print("CATS", code, cat_id, "birth", by)

    code, athletes = _req("GET", "/api/v1/athletes?limit=5", token=token)
    print("ATHLETES", code, len(athletes or []))

    code, dash = _req("GET", "/api/v1/dashboard", token=token)
    print("DASH", code)

    code, events = _req("GET", "/api/v1/events?limit=5", token=token)
    print("EVENTS", code, len(events or []) if isinstance(events, list) else events)

    code, stats = _req("GET", "/api/v1/club/stats", token=token)
    print(
        "STATS",
        code,
        {k: (stats or {}).get(k) for k in ("athletes_active", "license_expiring_count")}
        if isinstance(stats, dict)
        else stats,
    )

    if season_id:
        payload = {
            "season_id": season_id,
            "category_id": cat_id,
            "parent_phone": "0555880011",
            "parent_name": "Parent Smoke W1",
            "athlete": {
                "full_name": f"SMOKE W1 {date.today().isoformat()}",
                "birth_date": f"{by}-05-10",
                "parent_phone": "0555880011",
            },
            "source": "web",
        }
        code, created = _req("POST", "/api/v1/registrations", token=token, data=payload)
        print("REG_CREATE", code, "ok" if code in (200, 201) else created)

    # W-3 hint
    print("W3_RESET", 'docker exec -i wrbh-api python -c "from scripts.seed_demo import run; run()"')

    print("---")
    print("W2_LOGINS", f"{len(ok_logins)}/{len(SLUGS)}", ok_logins)
    w1_ok = season_id and code in (200, 201, 409)  # 409 = already exists ok for smoke repeat
    # last code may be REG_CREATE
    print("W1_PASS" if season_id and dash == 200 else "W1_CHECK", "logins", len(ok_logins))
    return 0 if len(ok_logins) >= 3 and season_id else 2


if __name__ == "__main__":
    sys.exit(main())
