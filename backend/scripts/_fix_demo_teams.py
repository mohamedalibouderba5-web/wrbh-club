"""Crée structure équipes saison courante pour demo-foot-safex si vide."""
import requests

B = "http://127.0.0.1:8081"
r = requests.post(
    f"{B}/api/v1/auth/login",
    data={
        "username": "admin@demo-foot-safex.test",
        "password": "DemoClub!2026",
        "club_slug": "demo-foot-safex",
    },
    timeout=20,
)
r.raise_for_status()
h = {"Authorization": f"Bearer {r.json()['access_token']}"}
before = requests.get(f"{B}/api/v1/teams", headers=h, timeout=20).json()
print("before", len(before))
if len(before) == 0:
    sync = requests.post(f"{B}/api/v1/teams/sync-structure", headers=h, timeout=60)
    print("sync", sync.status_code, sync.text[:300])
after = requests.get(f"{B}/api/v1/teams", headers=h, timeout=20).json()
print("after", len(after))
print("coaches_view", len(requests.get(f"{B}/api/v1/teams/coaches", headers=h, timeout=20).json()))
