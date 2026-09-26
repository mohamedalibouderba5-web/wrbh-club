# WRBH on existing Hetzner VPS — ali-server (ex esta-saas display name)

## HARD RULES
- NEVER create another Hetzner Cloud server
- Server: **ali-server** / ID `161916612` / IP `46.224.38.201` / project Ali-sass
- NEVER touch `/opt/esta`, `esta_*` containers, `esta_*` volumes, or other project DBs
- Keep **Render** (`wrbh-*.onrender.com`) live until cutover is validated

## Current status (2026-08-13)
| Piece | URL / location | Status |
|-------|----------------|--------|
| WRBH API (new) | http://46.224.38.201:8081/health | **UP** v1.15.3 |
| WRBH Web (new) | http://46.224.38.201:8080/ | **UP** (empty DB until migrate) |
| WRBH Postgres | Docker `wrbh-db` / volume `wrbh_pg_data` | **UP** isolated |
| ESTA (neighbor) | Caddy :80/:443 | **untouched** |
| Render (old) | https://wrbh-api.onrender.com | **still primary** for registrations |

## Layout
```
/opt/wrbh-club/
  .env                 # secrets chmod 600
  docker-compose.yml
  backend/
  web/
  migrate_from_url.sh
```

Ports **8080/8081** avoid colliding with ESTA Caddy on 80/443.

## Next: copy production data
1. In Cursor browser, open Render → wrbh-api → Environment → copy `DATABASE_URL`
2. On server (SSH):
```bash
SOURCE_DATABASE_URL='postgresql://…wrbh…' bash /opt/wrbh-club/migrate_from_url.sh
```
3. Verify login on http://46.224.38.201:8080
4. Only then point domain / mobile API URL to Hetzner
5. Only then stop Render billing

## Admin password on VPS
```bash
grep DEFAULT_ADMIN_PASSWORD /opt/wrbh-club/.env
```
(Do not commit or paste secrets into Git/chat.)
