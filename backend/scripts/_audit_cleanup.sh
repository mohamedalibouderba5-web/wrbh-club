#!/usr/bin/env bash
# Purge clubs/users ZZTEST + backfill parents club_id — WRBH only.
# Usage on VPS: bash /opt/wrbh-club/backend/scripts/_audit_cleanup.sh
# Prérequis : bash /opt/wrbh-club/backup_db.sh
set -euo pipefail
docker exec -i wrbh-db psql -U wrbh -d wrbh <<'SQL'
BEGIN;

-- Rattacher parents NULL au club de leur enfant
UPDATE users u SET club_id = sub.club_id
FROM (
  SELECT pc.parent_id, MIN(a.club_id) AS club_id
  FROM parent_children pc
  JOIN athletes a ON a.id = pc.athlete_id
  WHERE a.club_id IS NOT NULL
  GROUP BY pc.parent_id
) sub
WHERE u.id = sub.parent_id AND u.club_id IS NULL AND u.role = 'parent';

UPDATE parent_children pc SET club_id = a.club_id
FROM athletes a
WHERE pc.athlete_id = a.id AND pc.club_id IS NULL AND a.club_id IS NOT NULL;

UPDATE notifications n SET club_id = u.club_id
FROM users u
WHERE n.user_id = u.id AND n.club_id IS NULL AND u.club_id IS NOT NULL;

-- Purge parents / admins ZZTEST (FK audit_logs / messages d'abord)
DELETE FROM parent_children WHERE parent_id IN (
  SELECT id FROM users WHERE full_name ILIKE 'ZZTEST%'
);
DELETE FROM notifications WHERE user_id IN (
  SELECT id FROM users WHERE full_name ILIKE 'ZZTEST%'
);
DELETE FROM audit_logs WHERE user_id IN (
  SELECT id FROM users WHERE full_name ILIKE 'ZZTEST%'
);
DELETE FROM push_tokens WHERE user_id IN (
  SELECT id FROM users WHERE full_name ILIKE 'ZZTEST%'
);
DELETE FROM parent_notification_prefs WHERE user_id IN (
  SELECT id FROM users WHERE full_name ILIKE 'ZZTEST%'
);
DELETE FROM users WHERE full_name ILIKE 'ZZTEST%';

-- Clubs zztest* et dépendances
CREATE TEMP TABLE zz ON COMMIT DROP AS SELECT id FROM clubs WHERE slug ILIKE 'zztest%';

DELETE FROM attendances WHERE club_id IN (SELECT id FROM zz)
  OR event_id IN (SELECT id FROM events WHERE club_id IN (SELECT id FROM zz));
DELETE FROM convocations WHERE club_id IN (SELECT id FROM zz)
  OR event_id IN (SELECT id FROM events WHERE club_id IN (SELECT id FROM zz));
DELETE FROM event_exceptions WHERE event_id IN (SELECT id FROM events WHERE club_id IN (SELECT id FROM zz));
DELETE FROM events WHERE club_id IN (SELECT id FROM zz);
DELETE FROM fee_installments WHERE club_id IN (SELECT id FROM zz);
DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE club_id IN (SELECT id FROM zz));
DELETE FROM payments WHERE club_id IN (SELECT id FROM zz);
DELETE FROM attachments WHERE club_id IN (SELECT id FROM zz)
  OR registration_id IN (SELECT id FROM registrations WHERE club_id IN (SELECT id FROM zz));
DELETE FROM registrations WHERE club_id IN (SELECT id FROM zz);
DELETE FROM team_memberships WHERE club_id IN (SELECT id FROM zz);
DELETE FROM team_coaches WHERE club_id IN (SELECT id FROM zz);
DELETE FROM teams WHERE club_id IN (SELECT id FROM zz);
DELETE FROM parent_children WHERE club_id IN (SELECT id FROM zz)
  OR athlete_id IN (SELECT id FROM athletes WHERE club_id IN (SELECT id FROM zz));
DELETE FROM emergency_contacts WHERE club_id IN (SELECT id FROM zz);
DELETE FROM athletes WHERE club_id IN (SELECT id FROM zz);
DELETE FROM categories WHERE club_id IN (SELECT id FROM zz);
DELETE FROM disciplines WHERE club_id IN (SELECT id FROM zz);
DELETE FROM seasons WHERE club_id IN (SELECT id FROM zz);
DELETE FROM notifications WHERE club_id IN (SELECT id FROM zz);
DELETE FROM push_tokens WHERE user_id IN (SELECT id FROM users WHERE club_id IN (SELECT id FROM zz));
DELETE FROM parent_notification_prefs WHERE club_id IN (SELECT id FROM zz)
  OR user_id IN (SELECT id FROM users WHERE club_id IN (SELECT id FROM zz));
DELETE FROM messages WHERE thread_id IN (
  SELECT id FROM message_threads WHERE club_id IN (SELECT id FROM zz)
);
DELETE FROM message_threads WHERE club_id IN (SELECT id FROM zz);
DELETE FROM audit_logs WHERE club_id IN (SELECT id FROM zz)
  OR user_id IN (SELECT id FROM users WHERE club_id IN (SELECT id FROM zz));
DELETE FROM announcements WHERE club_id IN (SELECT id FROM zz);
DELETE FROM ledger_entries WHERE club_id IN (SELECT id FROM zz);
DELETE FROM coach_payrolls WHERE club_id IN (SELECT id FROM zz);
DELETE FROM inventory_assignments WHERE club_id IN (SELECT id FROM zz);
DELETE FROM inventory_items WHERE club_id IN (SELECT id FROM zz);
DELETE FROM documents WHERE club_id IN (SELECT id FROM zz);
DELETE FROM media_objects WHERE club_id IN (SELECT id FROM zz);
DELETE FROM fee_plans WHERE club_id IN (SELECT id FROM zz);
DELETE FROM club_settings WHERE club_id IN (SELECT id FROM zz);
DELETE FROM venues WHERE club_id IN (SELECT id FROM zz);
DELETE FROM system_feedback_events WHERE club_id IN (SELECT id FROM zz);
DELETE FROM users WHERE club_id IN (SELECT id FROM zz);
DELETE FROM clubs WHERE id IN (SELECT id FROM zz);

SELECT 'clubs_zztest' AS k, count(*)::int AS n FROM clubs WHERE slug ILIKE 'zztest%';
SELECT 'parents_null' AS k, count(*)::int AS n FROM users WHERE role='parent' AND club_id IS NULL;
SELECT 'users_zztest' AS k, count(*)::int AS n FROM users WHERE full_name ILIKE 'ZZTEST%';
COMMIT;
SQL
echo PURGE_OK
