#!/usr/bin/env bash
# Install / refresh daily WRBH DB backup cron on ali-server ONLY.
# Never touches /opt/esta.
set -euo pipefail
ROOT=/opt/wrbh-club
SCRIPT="$ROOT/backup_db.sh"
mkdir -p "$ROOT/backups" "$ROOT/logs"
if [ ! -f "$SCRIPT" ]; then
  echo "Missing $SCRIPT — copy deploy/hetzner/backup_db.sh first" >&2
  exit 1
fi
chmod +x "$SCRIPT"
# Daily 02:15 UTC
CRON_LINE="15 2 * * * ROOT=$ROOT /bin/bash $SCRIPT >> $ROOT/logs/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "backup_db.sh" || true; echo "$CRON_LINE" ) | crontab -
echo "CRON_INSTALLED"
crontab -l | grep backup_db || true
