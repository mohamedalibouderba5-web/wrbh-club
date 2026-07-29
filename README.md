# WRBH Club — SaaS gestion club sportif

**Widad Riadi Baladiat Hammadi** · الوداد الرياضي لبلدية حمادي
Projet **séparé d’ESTA** — une API, deux clients (Web + Mobile Expo).

## Inventaire source

Voir [`docs/INVENTAIRE.md`](docs/INVENTAIRE.md) (Excel + logo + affiche).
ERD : [`docs/ERD.md`](docs/ERD.md) · Plan : [`docs/PLAN.md`](docs/PLAN.md)
**Cahier des charges (passation développeur humain) :** [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md)
**PDF pro :** [`docs/CAHIER_DES_CHARGES_WRBH.pdf`](docs/CAHIER_DES_CHARGES_WRBH.pdf)

## Architecture

```
Web (React/Vite)  ──┐
                    ├──▶ FastAPI /api/v1 ──▶ SQLite (dev) / Postgres (prod)
Mobile (Expo)     ──┘
```

## Démarrage local

### Option rapide (recommandée)

Double-clic / PowerShell à la racine :

```powershell
.\start-wrbh.ps1
```

Démarre API + Web s’ils ne tournent pas, puis ouvre http://127.0.0.1:5173

### 1. API

```bash
cd backend
# Python 3.12 ou 3.13 recommandé (pas 3.14 pour l’instant)
py -3.13 -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python scripts\seed_import.py
uvicorn app.main:app --reload --port 8000
```

- Docs : http://127.0.0.1:8000/api/docs
- Health : http://127.0.0.1:8000/health
- Wake : `POST /api/v1/system/wake`

### 2. Web admin

```bash
cd web
npm install
npm run dev
```

http://127.0.0.1:5173

### 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

Sur téléphone : mettre `extra.apiUrl` dans `app.json` sur l’IP LAN du PC (pas `127.0.0.1`).

## Comptes démo (après seed)

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Admin | admin@wrbh.local | admin123 |
| Parent | parent@wrbh.local | parent123 |
| Coach 1–5 | coach1@wrbh.local … | coach123 |

## Modules

- Structure : saisons, catégories (U13/U11/U9/U7…), équipes (dont U13 G1/G2 Excel)
- Athlètes & inscriptions (web + mobile parent)
- Agenda : entraînements, matchs, convocations + confirmation parent
- Finance : cotisations, ledger (transport Excel), paie coaches
- Inventaire, annonces, health/wake web **et** mobile
- Branding logo WRBH bleu/jaune

## Déploiement gratuit

- `render.yaml` — API + static web
- DB : Neon / Aiven Postgres → `DATABASE_URL`
- Cold start : boutons **Actualiser / Réveiller le serveur** (web + mobile)
- Mobile builds : voir [`mobile/README.md`](mobile/README.md)

## Secrets

Ne jamais committer `.env`. Utiliser `.env.example` uniquement.
