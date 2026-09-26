#!/usr/bin/env bash
set -euo pipefail
python3 <<'PY'
from pathlib import Path
import secrets, string
p = Path('/opt/wrbh-club/.env')
env = {}
for line in p.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v

def gen(n=48):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(n))

# Force strong secrets
env['SECRET_KEY'] = gen(64)
if len(env.get('POSTGRES_PASSWORD', '')) < 16:
    env['POSTGRES_PASSWORD'] = gen(32)
if len(env.get('DEFAULT_ADMIN_PASSWORD', '')) < 12:
    env['DEFAULT_ADMIN_PASSWORD'] = gen(20)
env['POSTGRES_USER'] = env.get('POSTGRES_USER') or 'wrbh'
env['POSTGRES_DB'] = env.get('POSTGRES_DB') or 'wrbh'
env['ENVIRONMENT'] = 'production'
env['CORS_ORIGINS'] = 'http://46.224.38.201:8080,http://127.0.0.1:8080,https://wrbh-web.onrender.com'
env['PUBLIC_API_URL'] = 'http://46.224.38.201:8081'
env['DEFAULT_ADMIN_EMAIL'] = env.get('DEFAULT_ADMIN_EMAIL') or 'admin@wrbh.dz'
env['ALLOW_TEST_CLEANUP'] = 'false'
p.write_text('\n'.join(f'{k}={v}' for k, v in env.items()) + '\n')
p.chmod(0o600)
print('SECRET_KEY_LEN', len(env['SECRET_KEY']))
print('POSTGRES_PASSWORD_LEN', len(env['POSTGRES_PASSWORD']))
PY
docker compose -f /opt/wrbh-club/docker-compose.yml --project-name wrbh up -d --force-recreate api
sleep 5
curl -sS --max-time 25 http://127.0.0.1:8081/health || true
echo
docker logs wrbh-api --tail 20
docker ps --filter name=esta- --format '{{.Names}} {{.Status}}'
docker ps --filter name=wrbh- --format '{{.Names}} {{.Status}} {{.Ports}}'
