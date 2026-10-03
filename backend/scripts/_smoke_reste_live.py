"""Smoke reste fiabilité — à lancer sur le VPS (localhost)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import requests

B = "http://127.0.0.1:8081"
W = "http://127.0.0.1:8080"
CANDS = [
    ("demo-foot-safex", "admin@demo-foot-safex.test", "DemoClub!2026"),
    ("horizon-blida-882", "admin@horizon-blida-882.test", "DemoClub!2026"),
    ("audit-ess-9475", "admin@audit-ess-9475.test", "DemoClub!2026"),
]


def main() -> None:
    for slug, user, pwd in CANDS:
        r = requests.post(
            f"{B}/api/v1/auth/login",
            data={"username": user, "password": pwd, "club_slug": slug},
            timeout=20,
        )
        print("login", slug, r.status_code)
        if r.status_code != 200:
            continue
        tok = r.json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        print(" teams", len(requests.get(f"{B}/api/v1/teams", headers=h, timeout=20).json()))
        print(
            " teams_web",
            len(requests.get(f"{W}/api/v1/teams", headers=h, timeout=20).json()),
        )
        print(
            " web_login",
            requests.post(
                f"{W}/api/v1/auth/login",
                data={"username": user, "password": pwd, "club_slug": slug},
                timeout=20,
            ).status_code,
        )
        inst = requests.get(f"{B}/api/v1/installments?status=due&limit=5", headers=h, timeout=20)
        rows = inst.json() if inst.ok else []
        print(" due", len(rows) if isinstance(rows, list) else inst.status_code)
        if rows:
            due = rows[0]
            iid = due["id"]
            aid = due["athlete_id"]
            paid0 = Decimal(str(due.get("amount_paid") or 0))
            q = requests.post(
                f"{B}/api/v1/payments/quick",
                headers=h,
                json={
                    "payment_type": "inscription",
                    "athlete_id": aid,
                    "amount": 100,
                    "method": "cash",
                    "paid_on": date.today().isoformat(),
                    "installment_id": iid,
                },
                timeout=30,
            )
            print(" quick", q.status_code, q.text[:200])
            if q.ok:
                print(" match", q.json().get("installment_id") == iid)
                print(" paid_was", float(paid0))
        return
    raise SystemExit("no login")


if __name__ == "__main__":
    main()
