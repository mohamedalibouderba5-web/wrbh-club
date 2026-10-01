#!/usr/bin/env bash
# Backup Postgres WRBH only — never touch /opt/esta or esta_* containers.
# Run on ali-server: bash /opt/wrbh-club/backup_db.sh
set -euo pipefail
ROOT=/opt/wrbh-club
mkdir -p "$ROOT/backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker exec wrbh-db pg_dump -U "${POSTGRES_USER:-wrbh}" -d "${POSTGRES_DB:-wrbh}" -Fc -f "/tmp/wrbh_${STAMP}.dump"
docker cp "wrbh-db:/tmp/wrbh_${STAMP}.dump" "$ROOT/backups/wrbh_${STAMP}.dump"
docker exec wrbh-db rm -f "/tmp/wrbh_${STAMP}.dump"
docker exec wrbh-db pg_dump -U "${POSTGRES_USER:-wrbh}" -d "${POSTGRES_DB:-wrbh}" --no-owner --no-acl \
  | gzip > "$ROOT/backups/wrbh_${STAMP}.sql.gz"
ls -lh "$ROOT/backups/wrbh_${STAMP}".*
# retention 14
cd "$ROOT/backups"
ls -1t wrbh_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t wrbh_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "BACKUP_OK $STAMP"
