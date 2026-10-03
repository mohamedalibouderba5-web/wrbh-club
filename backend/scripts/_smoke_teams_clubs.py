import requests

B = "http://127.0.0.1:8081"
for slug, u in [
    ("horizon-blida-882", "admin@horizon-blida-882.test"),
    ("audit-ess-9475", "admin@audit-ess-9475.test"),
    ("demo-foot-safex", "admin@demo-foot-safex.test"),
]:
    r = requests.post(
        B + "/api/v1/auth/login",
        data={"username": u, "password": "DemoClub!2026", "club_slug": slug},
        timeout=20,
    )
    print(slug, r.status_code)
    if r.status_code != 200:
        print(r.text[:120])
        continue
    h = {"Authorization": "Bearer " + r.json()["access_token"]}
    print(" teams", len(requests.get(B + "/api/v1/teams", headers=h, timeout=20).json()))
    print(" sports", len(requests.get(B + "/api/v1/disciplines", headers=h, timeout=20).json()))
