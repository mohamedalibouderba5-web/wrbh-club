#!/usr/bin/env bash
set -euo pipefail
echo "=== containers ==="
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
echo "=== env lengths ==="
python3 <<'PY'
from pathlib import Path
import secrets, string
p = Path('/opt/wrbh-club/.env')
env = {}
for line in p.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v
print({k: len(env.get(k, '')) for k in ['POSTGRES_PASSWORD', 'SECRET_KEY', 'DEFAULT_ADMIN_PASSWORD']})

def gen(n=32):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(n))

changed = False
for k, n in [('POSTGRES_PASSWORD', 32), ('SECRET_KEY', 64), ('DEFAULT_ADMIN_PASSWORD', 20)]:
    if len(env.get(k, '')) < 8:
        env[k] = gen(n)
        changed = True
        print('FIXED', k)
# ensure required keys
env.setdefault('POSTGRES_USER', 'wrbh')
env.setdefault('POSTGRES_DB', 'wrbh')
env.setdefault('ENVIRONMENT', 'production')
env.setdefault('CORS_ORIGINS', 'http://46.224.38.201:8080,http://127.0.0.1:8080,https://wrbh-web.onrender.com')
env.setdefault('PUBLIC_API_URL', 'http://46.224.38.201:8081')
env.setdefault('DEFAULT_ADMIN_EMAIL', 'admin@wrbh.dz')
env.setdefault('ALLOW_TEST_CLEANUP', 'false')
if changed:
    p.write_text('\n'.join(f'{k}={v}' for k, v in env.items()) + '\n')
    p.chmod(0o600)
    print('ENV_REWRITTEN')
else:
    print('ENV_OK')
PY

docker compose -f /opt/wrbh-club/docker-compose.yml --project-name wrbh up -d
sleep 4
echo "=== health ==="
curl -sS --max-time 25 http://127.0.0.1:8081/health || true
echo
curl -sS -o /dev/null -w 'web=%{http_code}\n' --max-time 15 http://127.0.0.1:8080/ || true
echo "=== api logs ==="
docker logs wrbh-api --tail 40 || true
echo "=== esta check ==="
docker ps --filter name=esta- --format '{{.Names}} {{.Status}}'
