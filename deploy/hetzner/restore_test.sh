#!/usr/bin/env bash
# B2 — test de restauration sur base jetable (ne touche PAS wrbh).
# Usage VPS: bash /opt/wrbh-club/deploy/hetzner/restore_test.sh [dump_path]
set -euo pipefail
ROOT=/opt/wrbh-club
DUMP="${1:-}"
if [[ -z "$DUMP" ]]; then
  DUMP=$(ls -1t "$ROOT/backups"/wrbh_*.dump 2>/dev/null | head -n1 || true)
fi
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Aucun dump trouvé dans $ROOT/backups" >&2
  exit 1
fi
echo "RESTORE_TEST dump=$DUMP"
# Conteneur jetable Postgres
docker rm -f wrbh-restore-test >/dev/null 2>&1 || true
docker run -d --name wrbh-restore-test \
  -e POSTGRES_USER=wrbh -e POSTGRES_PASSWORD=wrbh -e POSTGRES_DB=wrbh_restore \
  postgres:17-alpine >/dev/null
sleep 4
docker cp "$DUMP" wrbh-restore-test:/tmp/restore.dump
# Créer DB + restore
docker exec wrbh-restore-test pg_restore -U wrbh -d wrbh_restore --clean --if-exists /tmp/restore.dump \
  || docker exec wrbh-restore-test bash -c 'createdb -U wrbh wrbh_restore 2>/dev/null; pg_restore -U wrbh -d wrbh_restore --clean --if-exists /tmp/restore.dump'
COUNT=$(docker exec wrbh-restore-test psql -U wrbh -d wrbh_restore -At -c "SELECT count(*) FROM clubs;")
echo "RESTORE_OK clubs=$COUNT"
docker rm -f wrbh-restore-test >/dev/null
echo "RESTORE_TEST_DONE"
