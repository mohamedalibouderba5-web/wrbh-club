# Mise en ligne WRBH — Guide complet

Architecture cible (gratuite / freemium) :

```
Parents / Coaches / Admin
        │
        ├─ Navigateur ──▶ wrbh-web (Render Static)
        │                      │
        │                      ▼  (VITE_API_URL)
        ├─ App mobile ──▶ wrbh-api (Render Web Service)
        │                      │
        │                      ▼
        └─ Téléchargement APK / TestFlight
                           Postgres (Neon ou Aiven)
```

> « Hyvel » dans nos échanges = **base Postgres gratuite** (Neon **ou** Aiven).  
> **Render** = API + site web. Les deux sont complémentaires.

---

## Ce que VOUS devez préparer (avant que je configure le code)

### A. Comptes à créer (gratuits)

| # | Service | Pourquoi | Lien typique |
|---|---------|----------|--------------|
| 1 | **GitHub** | Héberger le code ; Render déploie depuis le repo | github.com |
| 2 | **Render** | API Python + site web static | render.com |
| 3 | **Neon** *ou* **Aiven** | Postgres production | neon.tech / aiven.io |
| 4 | **Expo** (eas.dev) | Build APK Android + iOS | expo.dev |
| 5 | **Apple Developer** (optionnel iOS) | TestFlight (~99 $/an) | developer.apple.com |

Android APK seul = **pas besoin** d’Apple. iOS public = compte Apple obligatoire.

### B. Infos à me donner pour que je finalise le projet

Copiez et remplissez :

```
[ ] Repo GitHub URL (une fois créé / poussé) : …
[ ] Choix DB : Neon  /  Aiven
[ ] URL API Render (après 1er deploy) : https://….onrender.com
[ ] URL Web Render : https://….onrender.com
[ ] Compte Expo email : …
[ ] Android seulement  /  Android + iOS TestFlight
[ ] Mot de passe admin PROD (différent de admin123) : … (ne pas coller ici en clair si public — via message privé / .env Render)
```

### C. Secrets — jamais dans Git

- `SECRET_KEY` (généré par Render)
- `DATABASE_URL` (fourni par Neon/Aiven)
- `DEFAULT_ADMIN_PASSWORD` (fort, prod)
- Tokens Expo / Apple

---

## Étapes dans l’ordre

### Étape 1 — Mettre le code sur GitHub

1. Créer un repo privé `wrbh-club` (ou public).
2. À la racine du projet (PowerShell) :

```powershell
cd "B:\Python\Gestion Club Sportive"
git init
git add .
git status   # vérifier qu’il n’y a PAS de .env, wrbh.db, node_modules
git commit -m "Initial WRBH club SaaS (API + web + mobile)"
git branch -M main
git remote add origin https://github.com/VOTRE_USER/wrbh-club.git
git push -u origin main
```

3. Vérifier `.gitignore` ignore : `.env`, `*.db`, `node_modules`, `.venv`, `.expo`.

---

### Étape 2 — Postgres (Neon **ou** Aiven)

**Option Neon (simple) :**
1. neon.tech → New project → région proche (EU).
2. Copier la **connection string** :  
   `postgresql://user:pass@host/db?sslmode=require`
3. Pour SQLAlchemy / psycopg2, utiliser :  
   `postgresql+psycopg2://user:pass@host/db?sslmode=require`

**Option Aiven :**
1. aiven.io → PostgreSQL free/trial → Create service.
2. Copier Service URI → même format `postgresql+psycopg2://…`.

Garder cette URL pour Render → `DATABASE_URL`.

---

### Étape 3 — Render : API (`wrbh-api`)

1. render.com → **New** → **Blueprint** (fichier `render.yaml`) **ou** Web Service manuel.
2. Connecter le repo GitHub.
3. Service API :
   - **Root Directory** : `backend`
   - **Runtime** : Python
   - **Build** : `pip install -r requirements.txt`
   - **Start** : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
4. Variables d’environnement :

| Clé | Valeur |
|-----|--------|
| `DATABASE_URL` | URL Neon/Aiven (`postgresql+psycopg2://…`) |
| `SECRET_KEY` | Generate (Render) |
| `ENVIRONMENT` | `production` |
| `PYTHONPATH` | `.` ou chemin Render du root backend |
| `CORS_ORIGINS` | URL du site web (étape 4) — à mettre à jour après |
| `DEFAULT_ADMIN_EMAIL` | ex. `admin@wrbh.dz` |
| `DEFAULT_ADMIN_PASSWORD` | mot de passe fort |

5. Deploy → noter l’URL : `https://wrbh-api-xxxx.onrender.com`
6. Tester : `https://wrbh-api-xxxx.onrender.com/health`
7. Seed prod (une fois) : shell Render ou script local pointant sur `DATABASE_URL` prod :

```bash
python scripts/seed_import.py
```

> Cold start free : 1er appel lent (~30–60 s). Le bouton **Réveiller le serveur** (web + mobile) sert à ça.

---

### Étape 4 — Render : Site web (`wrbh-web`)

1. New → **Static Site**
2. Root : `web`
3. Build : `npm install && npm run build`
4. Publish : `dist`
5. Rewrite SPA : `/*` → `/index.html`
6. Variable de build **obligatoire** :

| Clé | Valeur |
|-----|--------|
| `VITE_API_URL` | `https://wrbh-api-xxxx.onrender.com` |

7. Deploy → URL : `https://wrbh-web-xxxx.onrender.com`
8. Revenir à l’API → mettre `CORS_ORIGINS` = cette URL web (et éventuellement le domaine custom).
9. Ouvrir le site → login admin → page **Télécharger l’app**.

---

### Étape 5 — Brancher le web sur l’API (vérifs)

- [ ] `/health` OK
- [ ] Login admin OK
- [ ] Liste athlètes OK
- [ ] Bouton « Réveiller le serveur » OK
- [ ] Page `/download` accessible sans erreur

---

### Étape 6 — Application mobile (Expo / EAS)

1. Compte [expo.dev](https://expo.dev) → créer projet `wrbh-club`.
2. Dans `mobile/app.json` :
   - `extra.apiUrl` = URL API Render
   - `extra.eas.projectId` = ID Expo
3. Installer EAS CLI :

```bash
cd mobile
npm install
npm i -g eas-cli
eas login
eas build:configure
```

4. **Android APK** (téléchargeable depuis le site) :

```bash
eas build -p android --profile preview
```

5. À la fin → lien de téléchargement APK (Expo) **ou** héberger le fichier `.apk` :
   - sur Render (fichier static / bucket), ou
   - Google Drive / Cloudflare R2 / GitHub Release

6. Mettre ce lien sur la page web **Télécharger l’app** (bouton Android).

7. **iOS TestFlight** (si compte Apple) :

```bash
eas build -p ios --profile preview
eas submit -p ios
```

Puis lien TestFlight sur le même bouton iOS du site.

8. Deep link : scheme `wrbh://` déjà prévu dans `app.json`.

---

### Étape 7 — Page « Télécharger l’app » (site → mobile)

Sur le site en ligne, la page `/download` doit contenir :

| Bouton | Lien |
|--------|------|
| Android APK | URL directe `.apk` ou page Expo |
| iOS TestFlight | Lien TestFlight public/invite |
| QR code (optionnel) | même URL download |

Le site **et** l’app pointent vers **la même API Render**.

---

### Étape 8 — Sécurité & prod

- [ ] Changer tous les mots de passe démo (`admin123`, `parent123`, `coach123`)
- [ ] Créer vrais comptes parents / coachs
- [ ] Ne pas committer `.env`
- [ ] Sauvegardes Neon/Aiven activées si possible
- [ ] Vérifier CORS strict (pas `*` en prod longue durée)

---

## Ordre de travail pour l’agent (moi) une fois vos comptes prêts

1. Ajuster `render.yaml` + `VITE_API_URL` + CORS.
2. Script seed prod sûr + health.
3. Page Download avec vrais liens APK/TestFlight + QR.
4. Config `mobile/app.json` / `eas.json` pour API prod.
5. README déploiement final + checklist go-live.

**Vous faites :** GitHub push, comptes Render / Neon|Aiven / Expo, premier lien des services.  
**Je fais :** config code, variables, page download, guides build, correctifs CORS/API.

---

## Coûts approximatifs (free tier)

| Élément | Coût |
|---------|------|
| Render API + Static | 0 € (cold start) |
| Neon / Aiven free | 0 € (limites) |
| Expo builds | quota free / puis payant |
| Apple Developer (iOS) | ~99 $/an si TestFlight/App Store |
| Android APK sideload | 0 € |

---

## URLs finales typiques

```
Site     : https://wrbh-web-xxxx.onrender.com
API      : https://wrbh-api-xxxx.onrender.com
Docs API : https://wrbh-api-xxxx.onrender.com/api/docs
Download : https://wrbh-web-xxxx.onrender.com/download
Health   : https://wrbh-api-xxxx.onrender.com/health
```
