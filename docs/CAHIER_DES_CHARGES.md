# Cahier des charges — SaaS Gestion Clubs Sportifs (WRBH → Commercial)

**Document de passation pour développeur humain**  
**Date :** 28 juillet 2026  
**Produit actuel :** WRBH Club (Widad Riadi Baladiat Hammadi / الوداد الرياضي لبلدية حمادي)  
**Vision :** plateforme SaaS multi-clubs (Algérie / Afrique du Nord), bilingue FR+AR, devise DZD  
**Repo GitHub :** https://github.com/mohamedalibouderba5-web/wrbh-club  
**Workspace local :** `B:\Python\Gestion Club Sportive`  
**Version API live :** **1.11.0**

---

## 0. Comment utiliser ce document

| Destinataire | Usage |
|---|---|
| **Développeur humain** | Source de vérité pour reprendre le code, prioriser le chantier commercial, ne pas casser WRBH prod |
| **Product / direction** | Vision, problèmes résolus, tarification cible, roadmap |
| **Agent Cursor (Auto)** | Continue le développement en parallèle ; lit aussi `data/ERROR_FEEDBACK_LATEST.md` |

**Liens live**
- Web : https://wrbh-web.onrender.com  
- API : https://wrbh-api.onrender.com  
- Health : https://wrbh-api.onrender.com/health  
- APK : release GitHub `android-v1.0.0`  

**Docs déjà présentes**
- `docs/DEPLOY.md` — déploiement Render / Postgres / Expo  
- `docs/ERD.md` — schéma de données Mermaid + matrice rôles  
- `docs/INVENTAIRE.md` — scan Excel source WRBH  
- `docs/PLAN.md` — phases historiques  
- `data/README.md` — collecteur d’erreurs / feedback  

---

## 1. Problème métier (pourquoi ce logiciel existe)

### 1.1 Pain points des clubs (avant le logiciel)

1. **Inscriptions papier / Excel** : doublons, catégories U7–U13 mal calculées, photos perdues.  
2. **Cotisations floues** : qui a payé ? quelle échéance ? quel reçu ?  
3. **Parents non informés** : séances annulées, convocations, dettes.  
4. **Coachs** : présence / absence sans outil fiable.  
5. **Direction** : pas de tableau de bord (effectif, impayés, dépenses).  
6. **Multi-clubs demain** : chaque club veut « son » espace, sans partager les données.

### 1.2 Solutions apportées aujourd’hui (WRBH live)

| Problème | Solution dans le logiciel |
|---|---|
| Fiches joueurs dispersées | Module **Athlètes** + photos en base |
| Inscriptions chaotiques | Module **Inscriptions** + refs immuables `26-27/U13/0042` |
| Impayés invisibles | **Finance** (échéances, paiements, caisse, achats) |
| Séances / absences | **Agenda** + présences + coach remplaçant |
| Parents | Compte téléphone + app mobile / PWA |
| Coachs / équipes | **Équipes / Coachs** |
| Matériel | **Inventaire** (achat / prêt) |
| Com’ club | **Annonces** |
| Erreurs terrain | Bouton **Feedback** + collecteur auto |
| Cold start Render free | Bouton **Réveiller le serveur** |

### 1.3 Ce que le logiciel *n’est pas encore*

- Marketplace multi-clubs self-serve (inscription club + facturation SaaS)  
- Console **superadmin** plateforme  
- Sous-domaines `club.domaine.dz`  
- Stripe / CIB / paiement en ligne parents  
- SMS / WhatsApp transactionnel automatisé  
- SLA commercial (Render free = cold start)

---

## 2. Vision produit commerciale

### 2.1 Positionnement

**« Un SaaS de gestion pour clubs sportifs (football jeunes d’abord) : admin web + app parents/coachs, FR/AR, DZD, multi-tenant. »**

- **Client pilote / référence :** WRBH (club_id = 1)  
- **Marché cible :** clubs amateurs / semi-pro Algérie, puis Maghreb  
- **Modèle :** setup + abonnement annuel (voir §11)

### 2.2 Principes non négociables (déjà décidés)

1. Ne **jamais** casser la prod WRBH.  
2. `club_id` **uniquement** depuis JWT/session — jamais depuis l’input client.  
3. Accès inter-clubs → **404** (pas 403 révélateur).  
4. Pas de nouveaux hardcodes WRBH ; branding / catégories / tarifs **configurables**.  
5. Devise **DZD**, fuseau **Africa/Algiers**, UI **FR + AR**.  
6. « Terminé » = **en ligne sur Render**, pas seulement sur GitHub.  
7. Commits / push seulement sur demande explicite (sauf si ordre « mets en ligne »).

---

## 3. Utilisateurs & rôles

Fichier : `backend/app/core/roles.py`

| Rôle | Qui | Droits typiques |
|---|---|---|
| `superadmin` | Plateforme (futur) | Tous clubs — **UI absente** |
| `admin` | Secrétaire / admin club | Tout le back-office club |
| `direction` | Bureau | Stats, finance, validations |
| `staff` | Secrétariat | Inscriptions, athlètes, finance limitée |
| `coach` | Entraîneur | Agenda, présences, ses équipes |
| `parent` | Tuteur légal | Enfants, paiements vus, convocations, annonces |
| `player` | Joueur | Enum présent — **pas de surface produit** |

**Connexion**
- Staff : email (`admin@wrbh.local`, …)  
- Parent : téléphone DZ (`05/06/07…`)  
- Mot de passe temporaire possible → `must_change_password` force le changement  

---

## 4. Guide d’utilisation (complet)

### 4.1 Première connexion (Web)

1. Ouvrir https://wrbh-web.onrender.com  
2. Si l’API dort (free tier) : se connecter peut prendre 30–60 s ; utiliser **Actualiser / Réveiller le serveur**.  
3. Choisir **FR** ou **عربي**.  
4. Saisir téléphone parent **ou** email staff + mot de passe.  
5. Si demandé : changer le mot de passe (≥ 8 car., pas de mots faibles).  

**Si « Token invalide / Session expirée »** → se reconnecter (le site purge la session automatiquement).

### 4.2 Tableau de bord `/`

- Effectifs, actifs, parents, séances, inscriptions en attente, impayés.  
- Graphiques catégories U7–U13.  
- Snapshot finance (encaissé / reste / dépenses / paie).  
- Bouton **Réessayer** = recharger les données.

### 4.3 Athlètes `/athletes`

| Zone UI | Action |
|---|---|
| Formulaire « Ajouter un joueur » | Nom, naissance, lieu, groupe sanguin, tél. + nom parent, photo (Capturer / Importer) → **Enregistrer** |
| Filtres | Catégorie, recherche nom, statut |
| Tableau | Photo, id récent, # legacy, nom, cat., sang, parent, naissance, statut |
| Tri | Colonnes cliquables ; en **arabe** : **nouveaux d’abord** (décroissant) |
| Éditer | Statut, notes, infos, paiement rapide cotisation |

**Règles métier**
- Âge club : **5–17 ans** (config `MIN/MAX_ATHLETE_AGE`).  
- Téléphone DZ valide obligatoire à la création.  
- Catégorie déduite de l’année de naissance vs grilles U7/U9/U11/U13.

### 4.4 Inscriptions `/registrations`

- Créer une inscription (saison courante + catégorie).  
- Colonnes **N°** (`seq_no`) et **Réf.** immuable : `SAISON/CAT/NNNN` ex. `26-27/U13/0042`.  
- Approuver / rejeter.  
- Mode hors-ligne : file locale puis sync (bandeau).  
- Compte parent créé ou lié automatiquement au téléphone.

### 4.5 Agenda `/agenda`

- Créer / éditer séances (équipe, coach, coach **remplaçant**, adversaire, lieu, horaire).  
- Convocations / réponses.  
- Marquer présences.  
- Annuler une séance (notif parents côté modèle).

### 4.6 Équipes / Coachs `/teams`

- Lister équipes par catégorie.  
- Affecter coach titulaire / rôles.

### 4.7 Finance `/finance` (sous-onglets)

1. **Cotisations / Échéances** — formule / totaux en haut, tableau N°/Réf/échéance en bas ; édition **sans écraser** N°/réf.  
2. **Paiements joueurs** — historique paiements + reçus.  
3. **Achats** — matériel / dépenses équipement.  
4. **Recettes / Dépenses** — caisse (ledger).  

**Références immuables**
| Type | Format |
|---|---|
| Inscription | `26-27/U13/0001` |
| Paiement | `PAY/2026/00001` |
| Recette | `REC/2026/00001` |
| Dépense | `DEP/2026/00001` |
| Achat | `ACH/2026/00001` |
| Échéance | `ECH/2026/00001` |

**Tarifs défaut WRBH (configurables)** : mensuel 800 DZD · assurance 1500 · inscription 4000.

### 4.8 Matériel `/inventory`

- Articles, achat, affectation à un joueur, retour.

### 4.9 Annonces `/announcements`

- Publier FR/AR, épingler.

### 4.10 Télécharger l’app `/download` + `/install`

- Lien APK Android + guide PWA « Ajouter à l’écran d’accueil ».

### 4.11 Bouton Feedback (flottant jaune)

1. Cliquer **Feedback**.  
2. Type : bug / idée / autre.  
3. Choisir la **fonctionnalité / bouton** dans la liste (Athlètes, Inscriptions, Agenda…).  
4. Décrire → **Envoyer**.  
→ Stocké en DB + fichier `data/system_feedback.jsonl`.

### 4.12 Application mobile (Expo)

| Onglet | Usage |
|---|---|
| Accueil | Enfants, convocations, impayés |
| Agenda | Séances + réponses ; coach : présences |
| Paiements | Voir échéances ; staff : encaisser |
| Messages | Annonces / fils |
| Profil | Infos + enfants |

API mobile dédiée limitée : `/api/v1/mobile/home`, `/children` — le reste passe par les APIs partagées.

---

## 5. Architecture technique

### 5.1 Schéma global

```
┌─────────────────┐     ┌─────────────────┐
│  Web React/Vite │     │  Mobile Expo    │
│  PWA FR/AR      │     │  dz.wrbh.club   │
└────────┬────────┘     └────────┬────────┘
         │  HTTPS JWT            │
         └──────────┬────────────┘
                    ▼
         ┌──────────────────────┐
         │ FastAPI /api/v1      │
         │ Auth · Club · Finance│
         │ Agenda · Feedback    │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ PostgreSQL (Aiven/   │
         │ Neon) + MediaObject  │
         └──────────────────────┘
                    ▲
         Render: wrbh-api + wrbh-web (static)
```

### 5.2 Monorepo

| Dossier | Rôle |
|---|---|
| `backend/` | API FastAPI, modèles, Alembic, tests |
| `web/` | Back-office + PWA |
| `mobile/` | App parents/coachs |
| `docs/` | Documentation |
| `data/` | Journal feedback/erreurs |
| `assets/` | Logo / affiche |
| `render.yaml` | Blueprint Render |

### 5.3 Stack

| Couche | Techno |
|---|---|
| API | Python, FastAPI, SQLAlchemy, python-jose JWT, Passlib, Alembic |
| Web | React 18, Vite 6, TypeScript, React Router |
| Mobile | Expo Router, AsyncStorage |
| DB | Postgres prod · SQLite dev |
| Hosting | Render (API Docker + Static), GitHub |
| i18n | Dictionnaire maison FR/AR + RTL |

### 5.4 Auth

1. `POST /api/v1/auth/login` (form urlencoded) → `access_token`  
2. Header `Authorization: Bearer <jwt>`  
3. Claims : `sub` (user id), `role`, `club_id`, `exp` (~12 h)  
4. Rate limit login ; gate `must_change_password`

### 5.5 Multi-tenant (état réel)

| Élément | Statut |
|---|---|
| Colonne `club_id` + backfill WRBH=1 | ✅ |
| Isolation JWT | ✅ (partiel, NULL toléré legacy) |
| Slug club + branding API | ✅ API / ❌ UI login |
| Sous-domaines | ❌ |
| Onboarding self-serve | ❌ |
| Billing SaaS | ❌ (champs `plan` / `trial` seulement) |

Fichiers clés : `backend/app/core/tenant.py`, migration `003_multitenant_club_id.py`, tests `backend/tests/test_multitenant.py`.

### 5.6 Collecteur d’erreurs

| Élément | Détail |
|---|---|
| Auto web | `web/src/feedback/collector.ts` (onerror, unhandledrejection, HTTP ≠ 401) |
| Auto API | handler Exception dans `main.py` |
| User | `POST /api/v1/feedback/report` |
| Persistance | Table `system_feedback_events` + `data/system_feedback.jsonl` |
| Admin | `GET /api/v1/feedback/events`, `/export` |

---

## 6. Cartographie API (résumé)

Base : `https://wrbh-api.onrender.com/api/v1`

| Préfixe | Modules |
|---|---|
| `/auth` | login, me, change-password, users |
| `/club` | branding |
| `/system` | health, wake |
| `/` (club router) | seasons, categories, teams, bootstrap, stats |
| `/athletes` | CRUD, list sort/filter |
| `/registrations` | CRUD, approve/reject |
| `/` (agenda) | events, attendance, convocations |
| `/` (comms) | announcements, notifications, threads |
| finance paths | settings, installments, payments, ledger, payroll |
| `/inventory` | items, assign, purchase |
| `/mobile` | home, children |
| `/uploads` | photo ; `/media/{id}` |
| `/feedback` | events, report, list, export |

Health public : `GET /health` → `{ version, environment, … }`

---

## 7. Modèle de données (vue métier)

Voir aussi `docs/ERD.md`.

**Cœur**
- Club → Seasons → Categories → Teams → Athletes  
- Registration (saison + catégorie + refs)  
- Parent ↔ Athlete (`parent_children`)  
- FeeInstallment → Payment → Receipt  
- LedgerEntry, CoachPayroll  
- Event → Convocation → Attendance  
- InventoryItem → InventoryAssignment  
- MediaObject (photos en BYTEA pour survivre au disque éphémère Render)  
- SystemFeedbackEvent  

---

## 8. Écrans Web ↔ fichiers code

| Route | Fichier | Notes pour le développeur |
|---|---|---|
| `/login` | `web/src/pages/LoginPage.tsx` | Phone/email ; hint session expirée |
| `/` | `DashboardPage.tsx` | Bootstrap SWR |
| `/athletes` | `AthletesPage.tsx` | Tri AR décroissant forcé |
| `/registrations` | `RegistrationsPage.tsx` | Offline queue |
| `/agenda` | `AgendaPage.tsx` | Substitute coach |
| `/teams` | `TeamsPage.tsx` | |
| `/finance` | `FinancePage.tsx` | Gros fichier — sous-onglets |
| `/inventory` | `InventoryPage.tsx` | |
| `/announcements` | `AnnouncementsPage.tsx` | |
| `/download` | `DownloadPage.tsx` | |
| Layout | `layouts/AppLayout.tsx` | Nav + wake + FeedbackWidget |
| API client | `api/client.ts` | Cache + 401 logout + report erreurs |
| i18n | `i18n.tsx` | |

---

## 9. Environnement & déploiement

### 9.1 Variables API (Render)

`DATABASE_URL`, `SECRET_KEY` (≥24 car.), `ENVIRONMENT=production`, `CORS_ORIGINS`, `DEFAULT_ADMIN_*`, optionnel `SENTRY_DSN`, ages, branding.

### 9.2 Variables Web (build)

`VITE_API_URL=https://wrbh-api.onrender.com`  
`VITE_ANDROID_APK_URL=…`

### 9.3 Déploiement

1. Push `main` GitHub  
2. Render **ne redéploie pas toujours auto** → **Manual Deploy → Deploy latest commit** sur `wrbh-api` et `wrbh-web`  
3. Workspace Render : **WRHB** (pas le compte ESTA)  
4. Alembic : migrations versionnées ; en prod, `main.py` `_ensure_schema()` complète en idempotent  

### 9.4 Compte démo (ne pas publier en clair hors équipe)

Voir `README.md` / credentials rotatés en prod (admin123 **bloqué**).  
Ne jamais committer `backend/scripts/run_deep_audit.py` s’il contient des secrets.

---

## 10. Roadmap recommandée pour le développeur humain (SaaS commercial)

### Chantier A — Stabiliser WRBH (en cours / prioritaire)
- [ ] Corriger bugs remontés via Feedback  
- [ ] Perf / UX mobile web  
- [ ] Monitoring (Sentry)  
- [ ] Backup Postgres documenté  

### Chantier B — Multi-tenant produit (suite « Chantier 1 »)
1. Login : sélection club par **slug**  
2. Durcir isolation (interdire NULL `club_id`)  
3. Seed 2 clubs de test + tests E2E isolation  
4. Console **superadmin** (liste clubs, suspendre, impersonate lecture)  
5. Sous-domaines (phase 2)

### Chantier C — Commercialisation
1. Landing marketing  
2. Onboarding self-serve (créer club + admin)  
3. Plans `discovery` / `club` / `academy` + facturation  
4. Essai `trial_ends_on`  
5. Factures / reçus PDF export  

### Chantier D — Différenciation
- WhatsApp / SMS rappels échéances  
- Paiement en ligne parents  
- Stats avancées / export Excel  
- White-label (logo, couleurs, nom app)

---

## 11. Tarification (proposition marché — à valider)

*Indicatif Algérie, d’après étude interne conversation produit — **pas encore codé**.*

| Offre | Contenu | Prix indicatif |
|---|---|---|
| **Setup** | Import données, formation, mise en ligne club | **~ 35 000 DZD** one-shot |
| **Abonnement Club** | 1 club, web + app, support standard | **15 000 – 25 000 DZD / an** |
| **Academy / Premium** | Multi-équipes, white-label, support prioritaire | à définir (> 25 k) |
| **Discovery** | Essai / petit club | plan enum déjà prévu |

**Coûts d’infra actuels (ordre de grandeur)** : Render free + Postgres managed (voir `docs/DEPLOY.md`). Pour un SaaS payant : passer API en **always-on** (plus de cold start).

---

## 12. Critères d’acceptation (DoD)

Une fonctionnalité n’est « faite » que si :
1. Code sur `main` GitHub  
2. Tests backend verts (`pytest`) si zone sensible  
3. Build web OK (`npm run build`)  
4. **Déployé** API + Web Render  
5. Health `version` cohérente si bump  
6. Pas de régression WRBH (inscriptions / finance / login)  
7. Feedback collector ne masque pas les 401 session  

---

## 13. Organisation du travail (humain + Cursor)

| Qui | Fait quoi |
|---|---|
| **Développeur humain** | Architecture SaaS commercial, billing, onboarding, code review, décisions produit lourdes |
| **Cursor (Auto)** | Features WRBH, correctifs, feedback→fix, UI FR/AR, déploiements manuels Render |
| **Vous (product owner)** | Priorités, validation terrain WRBH, tarifs, choix des clubs pilotes |

**Règle de collab**
- Branches courtes / PRs petits (éviter un monolithe).  
- Ne pas modifier `SECRET_KEY` prod sans rotation coordonnée (invalide tous les JWT).  
- Lire `data/ERROR_FEEDBACK_LATEST.md` avant sprint bugs.

---

## 14. Glossaire

| Terme | Sens |
|---|---|
| WRBH | Club pilote Hammadi |
| Réf. immuable | Identifiant métier jamais réattribué |
| Cold start | Endormissement Render free |
| club_id | Isolant multi-tenant |
| Chantier 1 | Multi-tenant incrémental |
| PWA | App installable navigateur |
| Feedback | Réclamation utilisateur structurée |

---

## 15. Annexes — checklist passation

- [ ] Accès GitHub `wrbh-club`  
- [ ] Accès Render workspace **WRHB**  
- [ ] Accès Postgres (URL dans Render Env — ne pas coller dans le chat)  
- [ ] Comptes admin / coach / parent de test  
- [ ] Cloner le repo + `start-wrbh.ps1` local  
- [ ] Lire ce cahier + `docs/ERD.md` + `docs/DEPLOY.md`  
- [ ] Vérifier health `1.11.0+`  
- [ ] Installer app mobile Expo / APK  

---

**Fin du cahier des charges v1.0 (passation)**  
Prochaine révision : après premier sprint commercial (onboarding + slug login).
