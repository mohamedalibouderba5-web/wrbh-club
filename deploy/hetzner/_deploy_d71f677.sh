#!/usr/bin/env bash
set -euo pipefail
cd /opt/wrbh-club
SHA=d71f677
echo "=== extract wrbh-d71.tgz ==="
tar -xzf wrbh-d71.tgz
printf '%s\n' "$SHA" > GIT_SHA
printf '%s\n' "$SHA" > backend/GIT_SHA
find backend/app -name '*.py' -print0 | xargs -0 sed -i 's/\r$//' 2>/dev/null || true
find web/src -name '*.tsx' -o -name '*.ts' 2>/dev/null | xargs -r sed -i 's/\r$//' || true
if [[ -f .env ]]; then
  grep -v '^GIT_SHA=' .env > .env.tmp || true
  echo "GIT_SHA=$SHA" >> .env.tmp
  # APK cible 1.18.3 (même si APK pas encore uploadé — UpdateGate pointera dessus après build)
  python3 - <<'PY'
from pathlib import Path
p = Path(".env")
text = p.read_text() if p.exists() else ""
updates = {
    "GIT_SHA": "d71f677",
    "ANDROID_APP_VERSION": "1.18.3",
    "ANDROID_VERSION_CODE": "25",
    "ANDROID_APK_URL": "https://nadi-connect.com/wrbh-club-1.18.3.apk",
    "ANDROID_FORCE_UPDATE": "false",
    "ANDROID_RELEASE_NOTES": "Nadi Connect 1.18.3: Plus Materiel/Historique/Annonces; Impayes Accueil.",
}
lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if not line or line.startswith("#") or "=" not in line:
        out.append(line)
        continue
    k = line.split("=", 1)[0]
    if k in updates:
        out.append(f"{k}={updates[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")
p.write_text("\n".join(out) + "\n")
print("ENV_OK")
PY
else
  echo "GIT_SHA=$SHA" > .env
fi
export GIT_SHA="$SHA"
echo "=== build api web ==="
docker compose -p wrbh build api web
echo "=== recreate ==="
docker compose -p wrbh up -d --no-deps --force-recreate api web
sleep 16
echo "=== health ==="
curl -sS http://127.0.0.1:8081/health; echo
curl -sS http://127.0.0.1:8080/health; echo
TOK=$(curl -sS -X POST http://127.0.0.1:8081/api/v1/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin@wrbh.local&password=ExpoDash2026!&club_slug=wrbh' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
echo "=== dashboard unpaid_count ==="
curl -sS http://127.0.0.1:8081/api/v1/dashboard -H "Authorization: Bearer $TOK"; echo
echo "=== openapi import path ==="
curl -sS http://127.0.0.1:8081/openapi.json | python3 -c 'import sys,json; p=json.load(sys.stdin).get("paths",{}); print("import" in str(p), [k for k in p if "import" in k])'
echo DONE
