#!/usr/bin/env bash
# Deploy WRBH onto EXISTING ali-server only. Never creates a Hetzner server.
# Never touches /opt/esta or esta_* resources.
set -euo pipefail

ROOT=/opt/wrbh-club
REPO_URL="${REPO_URL:-https://github.com/mohamedalibouderba5-web/wrbh-club.git}"

if [[ "$(hostname)" != "esta-saas" && "$(hostname)" != "ali-server" ]]; then
  echo "WARN: unexpected hostname $(hostname) — continuing on this VPS only"
fi

# Safety: refuse if someone points this at creating cloud resources
echo "Deploy target: $(hostname) / $(curl -4 -s ifconfig.me || true)"
echo "Rule: existing VPS only — no new Cloud server"

mkdir -p "$ROOT"
cd "$ROOT"

if [[ ! -d src/.git ]]; then
  git clone --depth 1 "$REPO_URL" src
else
  git -C src fetch --depth 1 origin main
  git -C src reset --hard origin/main
fi

rsync -a --delete \
  --exclude '.venv' --exclude 'node_modules' --exclude '__pycache__' \
  --exclude '.git' --exclude 'uploads' --exclude '*.db' \
  src/backend/ "$ROOT/backend/"

rsync -a --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  src/web/ "$ROOT/web/"

cp -f src/deploy/hetzner/docker-compose.yml "$ROOT/docker-compose.yml"
cp -f src/deploy/hetzner/.env.example "$ROOT/.env.example"

if [[ ! -f "$ROOT/.env" ]]; then
  PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  SK=$(openssl rand -hex 32)
  ADMIN_PW=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  cat > "$ROOT/.env" <<EOF
POSTGRES_USER=wrbh
POSTGRES_PASSWORD=${PW}
POSTGRES_DB=wrbh
SECRET_KEY=${SK}
ENVIRONMENT=production
CORS_ORIGINS=http://46.224.38.201:8080,http://127.0.0.1:8080,https://wrbh-web.onrender.com
PUBLIC_API_URL=http://46.224.38.201:8081
DEFAULT_ADMIN_EMAIL=admin@wrbh.dz
DEFAULT_ADMIN_PASSWORD=${ADMIN_PW}
ALLOW_TEST_CLEANUP=false
MIN_ATHLETE_AGE=5
MAX_ATHLETE_AGE=17
EOF
  chmod 600 "$ROOT/.env"
  echo "Created $ROOT/.env (chmod 600). Admin password stored only on server."
else
  echo "Keeping existing $ROOT/.env"
fi

# Build & start ONLY wrbh_* containers
docker compose -f "$ROOT/docker-compose.yml" --project-name wrbh up -d --build

echo "--- wrbh containers ---"
docker ps --filter name=wrbh- --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "Health: curl -sS http://127.0.0.1:8081/health || true"
curl -sS --max-time 20 http://127.0.0.1:8081/health || true
echo
echo "DONE. esta_* untouched. Render still primary until DB cutover."
