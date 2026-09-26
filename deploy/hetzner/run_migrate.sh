#!/usr/bin/env bash
# Migrate WRBH Aiven DB -> local wrbh-db ONLY. Never touch esta_*.
set -euo pipefail
cd /opt/wrbh-club

SRC_FILE=/opt/wrbh-club/.migrate_source
if [[ ! -f "$SRC_FILE" ]]; then
  echo "Missing $SRC_FILE"
  exit 1
fi

# Read URL without shell-sourcing (passwords may contain $ # ! etc.)
SOURCE_DATABASE_URL=$(grep -E '^SOURCE_DATABASE_URL=' "$SRC_FILE" | head -1 | cut -d= -f2-)
if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "SOURCE_DATABASE_URL empty"
  exit 1
fi

case "$SOURCE_DATABASE_URL" in
  *gestion-ecoles*|*esta_esta*|*ecole-pro*)
    echo "REFUSED: other project URL"
    exit 2
    ;;
esac

if [[ "$SOURCE_DATABASE_URL" != *"/wrbh"* ]]; then
  echo "REFUSED: URL must target /wrbh database"
  exit 2
fi

echo "OK: wrbh source URL present (len=${#SOURCE_DATABASE_URL})"
echo "Dumping from Aiven (WRBH)..."

# Write env file for docker (no shell expansion of password)
printf 'SOURCE_DATABASE_URL=%s\n' "$SOURCE_DATABASE_URL" > /opt/wrbh-club/.migrate_docker.env
chmod 600 /opt/wrbh-club/.migrate_docker.env

docker run --rm \
  --env-file /opt/wrbh-club/.migrate_docker.env \
  -v /opt/wrbh-club:/out \
  postgres:17-alpine \
  sh -c 'pg_dump "$SOURCE_DATABASE_URL" --no-owner --no-acl -F c -f /out/wrbh_prod.dump'

rm -f /opt/wrbh-club/.migrate_docker.env
echo "Dump size: $(wc -c < /opt/wrbh-club/wrbh_prod.dump) bytes"

echo "Restoring into wrbh-db..."
docker cp /opt/wrbh-club/wrbh_prod.dump wrbh-db:/tmp/wrbh.dump
PGUSER=$(grep '^POSTGRES_USER=' /opt/wrbh-club/.env | cut -d= -f2-)
PGPASS=$(grep '^POSTGRES_PASSWORD=' /opt/wrbh-club/.env | cut -d= -f2-)
PGDB=$(grep '^POSTGRES_DB=' /opt/wrbh-club/.env | cut -d= -f2-)

set +e
docker exec -e PGPASSWORD="$PGPASS" wrbh-db \
  pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists --no-owner --no-acl /tmp/wrbh.dump
RC=$?
set -e
echo "pg_restore exit=$RC (1 can mean warnings only)"

docker compose -f /opt/wrbh-club/docker-compose.yml --project-name wrbh restart api
sleep 5
curl -sS http://127.0.0.1:8081/health; echo
docker exec -e PGPASSWORD="$PGPASS" wrbh-db \
  psql -U "$PGUSER" -d "$PGDB" -c "SELECT count(*) AS athletes FROM athletes;"
docker exec -e PGPASSWORD="$PGPASS" wrbh-db \
  psql -U "$PGUSER" -d "$PGDB" -c "SELECT count(*) AS registrations FROM registrations;"

shred -u /opt/wrbh-club/.migrate_source 2>/dev/null || rm -f /opt/wrbh-club/.migrate_source
echo "DONE migrate. esta_* untouched."
