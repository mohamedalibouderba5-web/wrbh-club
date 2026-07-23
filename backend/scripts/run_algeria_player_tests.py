#!/usr/bin/env python3
"""
Seed + full functional tests for WRBH (identifiable TEST batch).

Marker: TEST-WRBH-BATCH / names prefixed with [TEST]
Ages: only within season categories U7–U13 (all ≤ 17).
Photos: scripts/test_assets/players/*

Usage:
  python scripts/run_algeria_player_tests.py --base https://wrbh-api.onrender.com
  python scripts/run_algeria_player_tests.py --cleanup
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(__file__).resolve().parent / "test_assets" / "players"
MARKER = "TEST-WRBH-BATCH"

# Homage names (Algerian football) — kids ages only
PLAYERS = [
    # U13 2014-2015
    {"name": "Riyad Mahrez", "birth": "2014-05-21", "cat": "U13", "place": "Sarcelles"},
    {"name": "Islam Slimani", "birth": "2014-11-02", "cat": "U13", "place": "Alger"},
    {"name": "Yacine Brahimi", "birth": "2015-02-08", "cat": "U13", "place": "Paris"},
    {"name": "Sofiane Feghouli", "birth": "2015-07-26", "cat": "U13", "place": "Levallois"},
    # U11 2016-2017
    {"name": "Ismaël Bennacer", "birth": "2016-03-01", "cat": "U11", "place": "Arles"},
    {"name": "Youcef Atal", "birth": "2016-09-17", "cat": "U11", "place": "Boghni"},
    {"name": "Aïssa Mandi", "birth": "2017-01-22", "cat": "U11", "place": "Châlons"},
    {"name": "Youcef Belaïli", "birth": "2017-06-14", "cat": "U11", "place": "Oran"},
    # U9 2018-2019
    {"name": "Rabah Madjer", "birth": "2018-04-15", "cat": "U9", "place": "Hussein Dey"},
    {"name": "Lakhdar Belloumi", "birth": "2018-10-29", "cat": "U9", "place": "Mascara"},
    {"name": "Nabil Bentaleb", "birth": "2019-02-12", "cat": "U9", "place": "Lille"},
    {"name": "Ramy Bensebaini", "birth": "2019-08-03", "cat": "U9", "place": "Constantine"},
    # U7 2020-2021
    {"name": "Raïs M'Bolhi", "birth": "2020-01-25", "cat": "U7", "place": "Paris"},
    {"name": "Faouzi Ghoulam", "birth": "2020-06-18", "cat": "U7", "place": "Saint-Priest"},
    {"name": "Bagged Bounedjah", "birth": "2021-03-09", "cat": "U7", "place": "Oran"},
    {"name": "Hillel Soudani", "birth": "2021-07-25", "cat": "U7", "place": "Chlef"},
]


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token = ""

    def _req(self, method: str, path: str, data=None, form=False, files=None):
        url = f"{self.base}{path}"
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = None
        if files:
            # multipart manual
            boundary = "----WRBH" + str(random.randint(100000, 999999))
            parts = []
            for name, (filename, raw, ctype) in files.items():
                parts.append(
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                    f"Content-Type: {ctype}\r\n\r\n".encode()
                    + raw
                    + b"\r\n"
                )
            body = b"".join(parts) + f"--{boundary}--\r\n".encode()
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        elif form:
            body = urllib.parse.urlencode(data or {}).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif data is not None:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read()
                if not raw:
                    return None
                return json.loads(raw.decode())
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            raise RuntimeError(f"{method} {path} -> {e.code}: {detail}") from e

    def login(self, username: str, password: str):
        tok = self._req("POST", "/api/v1/auth/login", {"username": username, "password": password}, form=True)
        self.token = tok["access_token"]
        return tok


def pick_images(n: int) -> list[Path]:
    files = sorted(
        [p for p in ASSETS.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}],
        key=lambda p: p.name,
    )
    if not files:
        raise SystemExit(f"No images in {ASSETS}")
    random.shuffle(files)
    out = []
    while len(out) < n:
        out.extend(files)
    return out[:n]


def run_tests(base: str, admin_user: str, admin_pass: str) -> dict:
    api = Api(base)
    report = {"base": base, "marker": MARKER, "steps": [], "athlete_ids": [], "ok": True}

    def step(name: str, fn):
        try:
            result = fn()
            report["steps"].append({"name": name, "status": "PASS", "detail": result})
            print(f"PASS  {name} — {result}")
            return result
        except Exception as exc:
            report["ok"] = False
            report["steps"].append({"name": name, "status": "FAIL", "detail": str(exc)})
            print(f"FAIL  {name} — {exc}")
            return None

    step("wake", lambda: api._req("POST", "/api/v1/system/wake"))
    step("health", lambda: api._req("GET", "/health"))
    login = step("login_admin", lambda: api.login(admin_user, admin_pass))
    if not login:
        return report

    seasons = step("list_seasons", lambda: api._req("GET", "/api/v1/seasons"))
    cats = step("list_categories", lambda: api._req("GET", "/api/v1/categories"))
    teams = step("list_teams", lambda: api._req("GET", "/api/v1/teams"))
    if not seasons or not cats:
        return report

    season = next((s for s in seasons if s.get("is_current")), seasons[0])
    cat_by_code = {c["code"]: c for c in cats}
    images = pick_images(len(PLAYERS))

    created = []
    for i, p in enumerate(PLAYERS):
        cat = cat_by_code.get(p["cat"])
        if not cat:
            report["steps"].append({"name": f"skip_{p['name']}", "status": "SKIP", "detail": f"missing {p['cat']}"})
            continue
        year = int(p["birth"][:4])
        if not (cat["birth_year_min"] <= year <= cat["birth_year_max"]):
            report["ok"] = False
            report["steps"].append(
                {"name": f"age_check_{p['name']}", "status": "FAIL", "detail": f"{year} not in {cat['code']}"}
            )
            continue
        # also enforce max 17 years relative to 2026
        age_in_2026 = 2026 - year
        if age_in_2026 > 17:
            report["ok"] = False
            report["steps"].append({"name": f"u17_cap_{p['name']}", "status": "FAIL", "detail": f"age {age_in_2026}"})
            continue

        phone = f"069911{1000 + i:04d}"
        legacy = 900 + i
        full_name = f"[TEST] {p['name']}"

        def make_reg(p=p, cat=cat, phone=phone, legacy=legacy, full_name=full_name, img=images[i], i=i):
            img_bytes = img.read_bytes()
            ctype = "image/png" if img.suffix.lower() == ".png" else "image/jpeg"
            up = api._req(
                "POST",
                "/api/v1/uploads/photo",
                files={"file": (img.name, img_bytes, ctype)},
            )
            photo_path = up["path"]
            reg = api._req(
                "POST",
                "/api/v1/registrations",
                {
                    "season_id": season["id"],
                    "category_id": cat["id"],
                    "subscription_fee": 4000,
                    "source": "web",
                    "parent_phone": phone,
                    "parent_name": f"[TEST] Parent {p['name']}",
                    "photo_path": photo_path,
                    "athlete": {
                        "full_name": full_name,
                        "birth_date": p["birth"],
                        "birth_place": p["place"],
                        "legacy_number": legacy,
                        "photo_path": photo_path,
                        "notes": f"{MARKER} | cat={p['cat']} | photo={img.name}",
                    },
                },
            )
            return {
                "reg_id": reg["id"],
                "athlete_id": reg["athlete_id"],
                "cat": p["cat"],
                "phone": phone,
                "parent_pw": reg.get("parent_temp_password"),
                "photo": photo_path,
            }

        row = step(f"register_photo_{p['cat']}_{i+1}_{p['name']}", make_reg)
        if row:
            created.append(row)
            report["athlete_ids"].append(row["athlete_id"])

    if not created:
        return report

    # list / get athlete
    step("list_athletes", lambda: f"count={len(api._req('GET', '/api/v1/athletes'))}")
    aid = created[0]["athlete_id"]
    step("get_athlete", lambda: api._req("GET", f"/api/v1/athletes/{aid}")["full_name"])

    # parent login by phone
    parent_phone = created[0]["phone"]
    parent_pw = created[0].get("parent_pw") or f"wrbh{parent_phone[-6:]}"

    def parent_flow():
        papi = Api(base)
        papi.login(parent_phone, parent_pw)
        kids = papi._req("GET", "/api/v1/athletes")
        home = papi._req("GET", "/api/v1/mobile/home")
        return {"kids": len(kids), "role": home.get("role"), "children": home.get("children_count")}

    step("parent_phone_login_mobile_home", parent_flow)

    # agenda: create training + roster + attendance + cancel notify
    team_id = None
    if teams:
        # prefer team matching first athlete category
        team_id = teams[0]["id"]

    def create_session():
        starts = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0).isoformat()
        ev = api._req(
            "POST",
            "/api/v1/events",
            {
                "event_type": "training",
                "title": f"{MARKER} Entraînement test",
                "title_ar": f"{MARKER} حصة تجريبية",
                "starts_at": starts,
                "team_id": team_id,
                "season_id": season["id"],
            },
        )
        return ev

    ev = step("create_training_event", create_session)
    if ev:
        eid = ev["id"]
        step("event_roster", lambda: f"players={len(api._req('GET', f'/api/v1/events/{eid}/roster'))}")

        def mark_att():
            roster = api._req("GET", f"/api/v1/events/{eid}/roster")
            if not roster:
                # mark created athletes anyway if team empty
                items = [{"athlete_id": a["athlete_id"], "status": "present"} for a in created[:5]]
            else:
                items = [{"athlete_id": r["athlete_id"], "status": "present"} for r in roster[:8]]
            return api._req("POST", f"/api/v1/events/{eid}/attendance", items)

        step("mark_attendance", mark_att)
        step(
            "cancel_session_notify",
            lambda: api._req(
                "POST",
                f"/api/v1/events/{eid}/cancel",
                {"reason": f"{MARKER} annulation test", "notify": True},
            )["is_cancelled"],
        )

    # status change with confirmation
    leave_id = created[-1]["athlete_id"]
    step(
        "status_abandon_with_note",
        lambda: api._req(
            "PATCH",
            f"/api/v1/athletes/{leave_id}",
            {
                "status": "Abandonne",
                "notes": f"{MARKER} départ simulé pour test",
                "confirm_status": True,
            },
        )["status"],
    )

    # announcements + notifications + dashboard/stats
    step(
        "create_announcement",
        lambda: api._req(
            "POST",
            "/api/v1/announcements",
            {
                "title": f"{MARKER} Annonce test",
                "title_ar": f"{MARKER} إعلان تجريبي",
                "body": "Test fonctionnel WRBH",
                "body_ar": "اختبار",
                "audience": "all",
            },
        )["id"],
    )
    step("list_notifications", lambda: f"n={len(api._req('GET', '/api/v1/notifications'))}")
    step("finance_dashboard", lambda: api._req("GET", "/api/v1/dashboard"))
    step(
        "club_stats",
        lambda: {
            "athletes": api._req("GET", "/api/v1/stats/club")["athletes_total"],
            "cats": [c["code"] for c in api._req("GET", "/api/v1/stats/club")["categories"]],
        },
    )
    step("list_registrations", lambda: f"n={len(api._req('GET', '/api/v1/registrations'))}")
    step("list_inventory", lambda: api._req("GET", "/api/v1/inventory/items"))
    step("branding", lambda: api._req("GET", "/api/v1/club/branding")["acronym"])

    report["created"] = created
    report["count"] = len(created)
    return report


def cleanup(base: str, admin_user: str, admin_pass: str):
    api = Api(base)
    api._req("POST", "/api/v1/system/wake")
    api.login(admin_user, admin_pass)
    return api._req("POST", f"/api/v1/system/cleanup-tests?marker={urllib.parse.quote(MARKER)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://wrbh-api.onrender.com")
    parser.add_argument("--user", default="admin@wrbh.local")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--cleanup", action="store_true")
    parser.add_argument("--report", default=str(Path(__file__).parent / "test_assets" / "last_test_report.json"))
    args = parser.parse_args()

    if args.cleanup:
        res = cleanup(args.base, args.user, args.password)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return

    report = run_tests(args.base, args.user, args.password)
    Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n=== SUMMARY ===")
    print(f"OK={report['ok']} athletes={report.get('count', 0)} ids={report.get('athlete_ids')}")
    print(f"Report: {args.report}")
    print(f"Cleanup later: python scripts/run_algeria_player_tests.py --cleanup --base {args.base}")
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
