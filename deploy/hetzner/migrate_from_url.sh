#!/usr/bin/env bash
# Copy WRBH production DB into wrbh-db ONLY.
# NEVER touch esta_postgres / esta volumes / other projects.
# Usage on ali-server:
#   SOURCE_DATABASE_URL='postgresql://...' bash /opt/wrbh-club/migrate_from_url.sh
set -euo pipefail

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "Set SOURCE_DATABASE_URL to the Render/Neon/Aiven WRBH URL (not ecole/esta)."
  exit 1
fi

# Refuse known other-project hosts
case "$SOURCE_DATABASE_URL" in
  *gestion-ecoles*|*esta*|*ecole*)
    echo "REFUSED: URL looks like another Ali-sass project. Abort."
    exit 2
    ;;
esac

echo "Dumping source (WRBH only)..."
docker run --rm --network wrbh_net \
  -e SOURCE_DATABASE_URL \
  postgres:17-alpine \
  sh -c 'pg_dump "$SOURCE_DATABASE_URL" --no-owner --no-acl -F c -f /tmp/wrbh.dump && cat /tmp/wrbh.dump' \
  > /opt/wrbh-club/wrbh_prod.dump

echo "Restoring into wrbh-db (volume wrbh_pg_data only)..."
docker cp /opt/wrbh-club/wrbh_prod.dump wrbh-db:/tmp/wrbh.dump
docker exec -e PGPASSWORD="$(grep '^POSTGRES_PASSWORD=' /opt/wrbh-club/.env | cut -d= -f2-)" wrbh-db \
  pg_restore -U wrbh -d wrbh --clean --if-exists /tmp/wrbh.dump || true

echo "Reload API"
docker compose -f /opt/wrbh-club/docker-compose.yml --project-name wrbh restart api
sleep 3
curl -sS http://127.0.0.1:8081/health
echo
echo "DONE. esta_* untouched. Render can stay live until you switch clients."
