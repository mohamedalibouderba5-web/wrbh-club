# ORDRE LOGICIEL MAÎTRE — Fonctionnement complet (site + app)

**Public :** développeurs application Android + équipe produit  
**Règle n°1 :** à **chaque** mise à jour (bouton, API, écran, rôle), ce document **doit être mis à jour** dans la même livraison.  
**Source de vérité :** le comportement du **site web** fait référence ; l’app doit **suivre le même couture métier**.

**Dernière mise à jour :** 2026-10-01  
**Stack visible utilisateur :** Site web + Application Android (**Nadi Connect** — SaaS multi-clubs, multi-sports)

---

## 0. Comment utiliser ce document (canal développeurs app)

1. Lire la section **Rôles & accès** avant tout écran.  
2. Pour chaque module : **écrans · boutons · API · notifications · limites**.  
3. Toute PR mobile doit citer la section modifiée (ex. `§5 Agenda`).  
4. Documents satellites :
   - `ORDRE_DEV_SUIVI_PARENTAL.md` — cycle séances & parents  
   - `ORDRE_DEV_APP_ANDROID.md` — **ordre synchro développeur application**  
   - `MATRICE_ROLES_ACCES.md` — tableau exhaustif droits  
   - `RAPPORT_PRODUIT_COMMERCIAL.md` — vision non technique  
   - `DEMO_SCRIPTEE_NADI_CONNECT.md` — script démo commerciale  
   - **`REPERE_PROJET_NADI_CONNECT_FR_AR.md`** — **fichier repère** (historique + architecture + reprise humaine)  
   - `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md` — qui reçoit quelles notifications  

### Règle parallèle (site + discussion app)

- Travailler **en parallèle** site et app est **autorisé**.  
- Le site est la source de vérité ; l’app **miroite**.  
- **Chaque** livraison site → lignes dans **§15** + tâches « À ajouter » dans `ORDRE_DEV_APP_ANDROID.md` (schémas / API / écrans).  
- L’historique des correctifs va aussi dans §15 (append-only).

---

## 1. Vue d’ensemble produit

| Pilier | Description |
|--------|-------------|
| Gestion club | Athlètes, inscriptions, équipes, coachs, matériel |
| Agenda sportif | Séances / matchs, présence, démarrage / fin |
| Suivi parental | Notifications + préférences (création, rappel, présence, fin) |
| Finance | Cotisations, paiements, caisse, tableau de bord graphes |
| Comptes & rôles | Admin club, direction, staff, coach, parent + **superadmin plateforme** |
| Traçabilité | Historique / corbeille (restauration) |
| Communication | Annonces, messages, notifications in-app |
| Console plateforme | Dashboard multi-clubs (`/platform`) : KPI globaux, présence, suspension |

**Client payeur :** le club. **Utilisateurs quotidiens :** direction, coachs, parents.  
**Opérateur logiciel :** rôle `superadmin` (hors club) — console `/platform` web + écran app `platform`.

---

## 2. Rôles (résumé)

| Rôle | Code API | Qui |
|------|----------|-----|
| **Super-admin plateforme** | `superadmin` | Ops Nadi Connect — tous les clubs (`club_id` NULL) |
| Administrateur | `admin` | Super utilisateur club (tout + comptes) |
| Direction / Gérant | `direction` | Pilotage ; peut aussi être coach d’équipe |
| Staff | `staff` | Secrétariat / opérations |
| Entraîneur | `coach` | Terrain : agenda, présences, équipes assignées |
| Parent | `parent` | Suivi enfants, inscriptions, convocations, notifs |

Détail boutons : → `MATRICE_ROLES_ACCES.md`

---

## 3. Navigation site (menus)

Visibles selon rôle (`AppLayout`) :

| Route | Libellé | admin | direction | staff | coach | parent |
|-------|---------|:-----:|:---------:|:-----:|:-----:|:------:|
| `/` | Tableau de bord | ✓ | ✓ | ✓ | ✓ | ✓ (vue parent) |
| `/athletes` | Athlètes | ✓ | ✓ | ✓ | ✓ | — |
| `/registrations` | Inscriptions | ✓ | ✓ | ✓ | — | ✓ |
| `/agenda` | Agenda | ✓ | ✓ | ✓ | ✓ | ✓ (lecture + RSVP) |
| `/teams` | Équipes / Coachs | ✓ | ✓ | ✓ | ✓ | — |
| `/users` | Comptes | ✓ | ✓ | — | — | — |
| `/history` | Historique / Corbeille | ✓ | ✓ | ✓ | — | — |
| `/feedback-admin` | Feedbacks | ✓ | ✓ | — | — | — |
| `/finance` | Finance | ✓ | ✓ | ✓ | — | —* |
| `/inventory` | Matériel | ✓ | ✓ | ✓ | — | — |
| `/announcements` | Annonces | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/guide` | Guide / Formation | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/download` | Télécharger app | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/platform` | Console plateforme | — | — | — | — | — |

\* Parent : pas le menu Finance complet ; peut voir cotisations liées via inscriptions / profil app.  
\*\* `/platform` : **uniquement** `superadmin` (pas dans le tableau club ci-dessus).

---

## 4. Tableau de bord

### Console plateforme (`superadmin`) — `/platform`
- KPI : clubs (total / actifs / suspendus / essais ≤7 j), comptes, **en ligne** (fenêtre 15 min via `last_seen_at`)
- Répartition par rôle + parents connectés ; plans (discovery / club / academy)
- Volumes : athlètes, inscriptions mois, paiements mois
- Onglets : vue d’ensemble · clubs (suspendre / plan) · comptes (filtre / activer-désactiver)
- API : `GET /api/v1/admin/dashboard` · `GET/PATCH /api/v1/admin/clubs` · `GET/PATCH /api/v1/admin/users`

### Staff / coach
- KPI : athlètes, actifs, parents, séances, inscriptions en attente, impayés  
- Segments Power BI : période, vue, statut, catégorie, type séance…  
- Graphes : anneau, secteur, barres, histogramme, courbe (étiquettes de données)

### Parent (site) — **vue dédiée**
- Mes enfants (fiche résumée)  
- Prochaines séances (lieu, type, statut : planifiée / en cours / terminée)  
- Notifications récentes  
- Impayés / cotisations liées aux enfants  
- Lien préférences notifications + téléchargement app  

**API :** `GET /api/v1/bootstrap`, `GET /api/v1/mobile/children`, `GET /api/v1/events`, `GET /api/v1/notifications`, `GET /api/v1/installments`

---

## 5. Agenda & suivi parental (critique)

### Boutons / actions

| Action | Qui | API | Notif parents |
|--------|-----|-----|---------------|
| Créer séance | admin, direction, staff, coach | `POST /events` | si `notify_parents` + approuvée |
| Lieu (`location_text`) | idem | body create/update | inclus dans corps notif |
| Case « Informer les parents » | idem | `notify_parents` | — |
| Valider séance | admin, direction, staff | `POST /events/{id}/approve` | oui (création) |
| Rejeter | admin, direction, staff | `POST /events/{id}/reject` | non |
| Démarrer | coach+staff | `POST /events/{id}/start` | `session_start` |
| Terminer | coach+staff | `POST /events/{id}/complete` | `session_end` |
| Présent / Absent / Retard | coach+staff | `POST /events/{id}/attendance` | `attendance` |
| Tous présents | coach+staff | attendance batch | par athlète |
| Annuler + notifier | coach+staff | `POST /events/{id}/cancel` | `cancel` |
| Répondre convocation | parent | `POST /convocations/{id}/respond` | — |
| Préférences notifs | parent | `GET/PUT /parent/notification-prefs` | champs : `notify_on_create/start/end/attendance/cancel`, `remind_minutes_before`, `remind_day_before` |
| Job rappels | admin | `POST /jobs/parental-reminders` | `reminder` |

### États séance
- `approval_status` : `pending_approval` | `approved` | `rejected`  
- `session_status` : `scheduled` | `in_progress` | `completed` | `cancelled`  

### Affichage parent (site + app)
- Liste séances de ses équipes enfants uniquement  
- Badges état + lieu  
- Pas de création / démarrage / pointage  
- Convocations : Confirmer / Décliner / Excusé  
- Messages → onglet Notifications  

Détail : `ORDRE_DEV_SUIVI_PARENTAL.md`

---

## 6. Athlètes

| Bouton / action | admin | direction | staff | coach | parent |
|-----------------|:-----:|:---------:|:-----:|:-----:|:------:|
| Lister / chercher | ✓ | ✓ | ✓ | ✓ | — |
| Créer / modifier | ✓ | ✓ | ✓ | ✓* | — |
| Archiver (Abandonne) | ✓ | ✓ | — | — | — |
| Supprimer (= archive) | ✓ | ✓ | — | — | — |
| Restaurer | via Historique | ✓ | ✓ | — | — |

\* Coach : selon API (équipes liées). Suppression = soft archive récupérable.

---

## 7. Inscriptions

| Action | staff+ | parent |
|--------|:------:|:------:|
| Nouvelle inscription | ✓ | ✓ (ses enfants / saison ouverte) |
| Valider / archiver | ✓ | — |
| Offline queue (PWA) | ✓ | ✓ |
| Photos / taille kit | ✓ | ✓ |

---

## 8. Équipes / Coachs

| Action | Qui |
|--------|-----|
| Créer équipe | admin, direction, staff |
| Assigner coach(s) | admin, direction, staff |
| Voir effectif | + coach |
| Archivage coach | admin, direction |

Un compte `direction` peut aussi être coach d’équipe (`TEAM_COACH_ROLES`).

---

## 9. Comptes (Users)

| Action | admin | direction |
|--------|:-----:|:---------:|
| Créer admin | ✓ | — |
| Créer direction/staff/coach/parent | ✓ | ✓ |
| Activer / désactiver | ✓ | ✓ |
| Reset mot de passe | ✓ | ✓ |
| Consulter matrice rôles (aide UI) | ✓ | ✓ |

---

## 10. Finance

Ordre UI (règle produit) :
1. Totaux KPI  
2. Onglets opérations (jaune = sélectionné) + bouton **Tableau de bord plein écran**  
3. Formules / tableaux / Enregistrer  
4. **Graphes en bas de page**  

Modules onglets : Cotisations · Paiements · Achats · Recettes/Dépenses  
Rôles : admin, direction, staff (écriture selon sous-actions ; paie coachs souvent direction+)

---

## 11. Matériel / Annonces / Feedback / Téléchargement

- **Matériel** : inventaire + attributions — staff+  
- **Annonces** : créer staff+ ; lire tous  
- **Feedback** : widget tous ; admin liste  
- **Download** : APK Android  

---

## 12. Historique / Corbeille

Page `/history` :
- Journal d’audit (qui a fait quoi)  
- Actions `delete` / `archive` → bouton **Restaurer** si supporté (athlète, inscription, ledger, user)  
- Droits : admin, direction, staff (pas parent, pas coach)

---

## 13. Application Android — miroir des modules

| Onglet / zone app | Équivalent site |
|-------------------|-----------------|
| Accueil / enfants | Dashboard parent |
| Agenda | Agenda + start/complete coach |
| Inscriptions | Registrations |
| Messages / Notifs | Annonces + notifications |
| Profil | Me + prefs parentales |
| Plus | Athlètes, équipes, etc. selon rôle |

**Obligation :** chaque nouveau bouton site → même capacité (ou message « bientôt ») documenté ici.

---

## 14. Restes développement (backlog priorisé)

| Priorité | Item |
|----------|------|
| P0 | Push Expo/FCM réel + cron rappels parentaux |
| P0 | Parcours parent site finalisé + démo compte test |
| P1 | Paramètres club UI (validation coach auto/manuel) |
| P1 | Matrice rôles appliquée côté chaque bouton (guards UI) |
| P1 | Corbeille dédiée (filtre delete/archive) + droits fins |
| P2 | RSVP avancé / chat séance |
| P2 | Marketplace clubs (vision commerciale) |
| P2 | Rebuild APK avec prefs parent + agenda cycle de vie | **Fait 1.6.0** |

---

## 15. Journal des mises à jour (append-only)

| Date | Changement | Impact app |
|------|------------|------------|
| 2026-09-26 | Dashboards graphes + segments | Afficher stats si API analytics |
| 2026-09-26 | Finance : ops d’abord, graphes en bas, plein écran | N/A site-first |
| 2026-09-26 | Suivi parental : start/complete/attendance/prefs | **Obligatoire** agenda + profil |
| 2026-09-26 | Création ORDRE_LOGICIEL_MAÎTRE + matrice rôles + vue parent site | Lire §4 parent |
| 2026-09-26 | Accueil parent web (`ParentHomePage`) : enfants, séances, notifs, prefs, limites UI | Miroir app Accueil |
| 2026-09-26 | Comptes : tableau limites rôles in-app ; Historique renommé Corbeille + filtre trash | Respecter mêmes menus app |
| 2026-09-30 | Multi-club produit : login `club_slug`, liste clubs, onboarding `/onboard` (essai discovery 14j, sports DZ) | App : stocker slug club + même login |
| 2026-09-30 | Multisport par club : `GET/POST /disciplines`, catégories préfixées, UI Équipes | App : section Sports du club |
| 2026-09-30 | **ORDRE_DEV_APP_ANDROID.md** — ordre synchro développeur application | **À exécuter avant d’avancer produit** |
| 2026-09-26 | **App 1.6.0** : miroir parental (start/complete/approve/attendance/prefs), badges, comptes, Accueil parent | Expo `1.6.0` / versionCode 9 |
| 2026-09-30 | **App 1.7.0** : login multi-club + branding, Sports du club, menus rôles (pas Finance parent/coach), onboard essai | Expo `1.7.0` / versionCode 10 |
| 2026-10-01 | **App 1.8.0** : Nadi Connect liens Offres/Guide/Pilote, N° joueur `list_number`, erreurs 429/500 lisibles ; **fix parents `club_id` déployé** (inscriptions) | Expo `1.8.0` / versionCode 11 |
| 2026-10-01 | **A10 ORDRE_CORRECTIFS** : commit `7b46f2d` = prod sync (A1/A2/A4/A7/A8/B3) + `/health.git_sha` + API **1.18.0** + cron backup | Rebuild app si 403 club suspendu (C12) |
| 2026-09-30 | Marque produit **Nadi Connect** (نادي = club) + logo + page `/pricing` (Discovery / Club / Academy) | Afficher Nadi Connect (pas WRBH comme nom produit) |
| 2026-10-01 | **Règle synchro** officialisée : parallèle site/app OK ; chaque livraison → §15 + `ORDRE_DEV_APP_ANDROID` (ajouts + schémas) | Lire §0 + ordre Android §10 |
| 2026-10-01 | **Landing** publique `/` (invité) + script démo `DEMO_SCRIPTEE_NADI_CONNECT.md` | Lien « Site / Offres » optionnel ; splash = Nadi Connect |
| 2026-10-01 | **Athlètes** : N° joueur = `list_number` (aligné Inscriptions), plus l’id DB (268…) ; Kit affiché | Afficher `list_number` / kit, pas `athlete.id` |
| 2026-10-01 | **Dashboard** : saison courante **par club** + cache bootstrap club-scoped ; graphes ne restent plus vides à tort | Rafraîchir Accueil / home stats |
| 2026-10-01 | **Fix bootstrap** : appels `list_categories` / `finance_dashboard` (Fail to fetch / graphes vides) | N/A API — recharger dashboard |
| 2026-10-01 | **Guide formation** `/guide` + `GUIDE_FORMATION_NADI_CONNECT.md` (tous rôles) | Lien optionnel « Guide » / WebView |
| 2026-10-01 | **Guide enrichi** : 16 chapitres, étapes, à faire / à ne pas faire, check-lists, dépannage, recherche | Miroir contenu formation (C3) |
| 2026-10-01 | **Étape 7 pilotes** : `PILOTES_COMMERCIAUX.md` + page `/pilote` + CTA landing/pricing | Lien optionnel « Devenir pilote » |
| 2026-10-01 | **Complément audit** (§2 bis) : **P0-6 suspension de club inopérante** (`get_current_club` utilisé par 0 endpoint, `get_current_club_id` par 78, statut lu seulement au login → impossible de couper un client impayé) ; **P0-7 `notify_role` sans filtre club** (`notify.py:56-60`) + `notify_user` crée les `Notification` sans `club_id` ; **P0-2 élargi** : 27 modèles sur 35 ont un `club_id` nullable ; P1-11 aucun endpoint de suspension/suppression de club | Revalider les notifications app après fix `notify_role` ; prévoir écran « club suspendu » (lecture seule) |
| 2026-10-01 | **ORDRE_CORRECTIFS_PRE_SALON.md** — plan 11 jours / 88 h avant **FormaTech Expo (12–15 oct., SAFEX Pavillon A)**. Lots A (remise en marche), B (domaine+HTTPS, backup, rate-limit), C (démo, licences/certificats médicaux, arabe Finance, super-admin, essai réel), D (hygiène). Hors scope avant salon : paiement en ligne, quotas, découpage monolithes. Non-dev : **déclaration ANPDP loi 18-07** + réponse hébergement + démo hors ligne obligatoire | Lot C Android : APK en `https://`, retrait `usesCleartextTraffic`, message `429`, miroir licence/certificat médical |
| 2026-10-01 | **AUDIT commercialisation** (`AUDIT_COMMERCIALISATION_2026-10-01.md`) : tests réels en prod. **P0-1 `POST /registrations` = HTTP 500 pour tous les clubs** (`ensure_parent_account()` reçoit `club_id` non déclaré dans `parents.py` de HEAD — correctif local non commité). P0-2 comptes parents créés `club_id=NULL` → visibles par tous les clubs (prouvé : 5 parents de test apparaissent chez WRBH). P0-3 prod en HTTP sans domaine → `isSecureContext=false`, PWA/service worker inopérants. P0-4 sauvegarde non automatisée. P0-5 onboard 500 si téléphone admin déjà pris (`users.phone` unique global) | **Inscription app Android également en panne** (même endpoint) ; après fix HTTPS → `app.json` en `https://` + retirer `usesCleartextTraffic` ; vérifier `GET /children` après cloisonnement parents |
| 2026-10-01 | **Lot A audit déployé prod** (`ORDRE_CORRECTIFS_PRE_SALON`) : A1 `parents.py` + appels `club_id` ; A2 parents/notifications scopés ; A4 onboard téléphone pré-check + IntegrityError→409 ; A5 purge `zztest*` + parents NULL=0 ; A7 suspension = écriture 403 / lecture OK via `get_current_club_id` ; A8 `notify_role`/`notify_user` filtrés club ; P1-5 filtre `club/list` ; P1-8 `/guide`+`/download` publics ; backup quotidien cron 02:15 UTC. **Prod vérifié** : `POST /athletes`+`POST /registrations` → **200**, parent `club_id` renseigné, liste clubs = wrbh + demo-judo-978 | **C1 débloqué** : retester Inscription app ; C3 revalider enfants parent ; C9 bandeau club suspendu ; C10 notifs club-only ; HTTPS (C2) encore ouvert |
| 2026-10-01 | **Vérification Lot A + A10** : A1/A2/A4/A5 confirmés en prod ; A7/A8 implémentés mais **non commités**. **A10 ajouté (bloquant)** : la prod exécute du code absent de `HEAD` (prouvé par le `409` onboard) → un déploiement git ferait régresser A2/A4/A7/A8. Couverture réelle mesurée = **43 %** (et non 5,4 % : l'ancien chiffre était un ratio de lignes, pas une couverture) mais `finance.py` **16 %**, `club.py` 24 %, `agenda.py` 23 %, `auth.py` 28 % → critère A6 réécrit par parcours. B5 fait (`/guide`+`/download` publics). Restent ouverts : A3 (63 `club_id.is_(None)`, 27 modèles), A9, Lots B/C/D. Reliquat : compte parent **id 171** `VERIFYFIX…` dans `demo-judo-978` | Journal app mis à jour : C1/C4/C5 **déjà faits** en 1.8.0 (`client.ts:25-45`) |
| 2026-10-01 | **RESTE_A_FAIRE_PAR_ROLE.md** — répartition du reste à faire sur les **3 développeurs** (système SaaS / web / Android), état vérifié dans le code. Web : C3 confirmé ouvert (`FinancePage`/`TeamsPage`/`InventoryPage` = **0 `useI18n`**), C5 (aucun `trial` dans `AppLayout`), C4, D17 (`PilotPage.tsx:73` slug démo en dur), B6. §4 = graphe de dépendances inter-rôles + 3 points de synchronisation (A10 d'abord, domaine aujourd'hui, schéma licence ≤ J5) | **Android : nouveau manque majeur C11 — aucune i18n dans l'app** (`useI18n`/`I18nManager` = 0 occurrence, arabe = 44 lignes en dur, pas de bascule ni RTL) alors que le web a FR/AR complet. **C12 ajouté** : `403` non géré dans `mobile/src` (seuls 401/429 le sont) → requis pour A7/C9. C2 toujours ouvert (`app.json:74` en `http://`, `usesCleartextTraffic:true`). Priorité app : C8 > C12+C9 > C2 > C10+C3 > C11 (Accueil+Agenda seulement) |
| 2026-10-01 | **Traduction arabe des 3 rapports** (demande client, pour diffusion aux développeurs et aux prospects arabophones) : `AUDIT_COMMERCIALISATION_2026-10-01_AR.md`, `ORDRE_CORRECTIFS_PRE_SALON_AR.md`, `RESTE_A_FAIRE_PAR_ROLE_AR.md`. Traduction intégrale, **termes techniques conservés en français** (noms de fichiers, `club_id`, endpoints, SQL, Python, `useI18n`, `IntegrityError`, Lots A/B/C/D, références P0-x / A-x / B-x / C-x / D-x) pour rester alignés sur le code. Les blocs de code, chemins et requêtes SQL sont inchangés | Rappel : l'app Android n'a **aucune i18n** (C11) — ces rapports arabes sont lisibles par un lecteur arabophone, l'app ne l'est pas encore |
| 2026-10-01 | **PDF arabes des 3 rapports** — `AUDIT_COMMERCIALISATION_2026-10-01_AR.pdf` (10 p.), `ORDRE_CORRECTIFS_PRE_SALON_AR.pdf` (14 p.), `RESTE_A_FAIRE_PAR_ROLE_AR.pdf` (9 p.). Générateur : `docs/_make_rapports_ar_pdf.py` (ReportLab + `arabic_reshaper` + `python-bidi`, police Arial/Consolas, charte navy/or). Points techniques : découpage des lignes **avant** le bidi (sinon les paragraphes multi-lignes se lisent de bas en haut), largeurs de colonnes inversées comme les colonnes en RTL, code/SQL/schémas laissés en LTR monospace non reshapés. `Page.printToPDF` indisponible dans le webview Cursor et WeasyPrint inutilisable sous Windows (GTK) — d'où la chaîne 100 % Python | Aucun impact code applicatif (documentation uniquement) |
| 2026-10-01 14h05 | **Vérification n°2 (code + production)**. **Fermés et prouvés** : **A10** (`/health` → `1.18.0` / `git_sha f27f161-nadi`, SHA présent dans git — le bloquant du matin est levé) ; **A8** (22 tests verts, test d'isolation ajouté) ; **B2** (`install_backup_cron.sh` + `restore_test.sh`) ; **B3** (`login_rate_limit=10` par compte **et** `login_rate_limit_ip=100`, onboard 5/30 séparé) ; **B4** (`/club/list` prod = **1 club**, `demo-judo-978` seul, WRBH masqué) ; **B5** (HTTP 200 en prod) ; branding Nadi Connect déployé. **Toujours ouverts backend** : **B1 (aucun HTTPS — chemin critique unique)**, A3 (63 `club_id.is_(None)`, tolérance `tenant.py:74`), C1 (pas de `seed_demo.py`), C2 (`license_valid_until`/`medical_cert` = 0 occurrence), C5 (`trial_ends_on` jamais relu), A9 (0 route `/admin/clubs`), D1 (16 sites `is_current` global). **Web : seul le branding a été livré** — C3 (0 `useI18n` sur Finance/Teams/Inventory), C4 (0 `superadmin`), C5 (0 `trial` dans `AppLayout` ; les 14 « essai » sont du texte commercial), D17, B6 (`wrbh-web.onrender.com` répond encore 200) tous ouverts. ⚠ **Dérive git réamorcée** : 11 fichiers `web/`+`mobile/` modifiés non commités — la règle A10 vaut pour les 3 développeurs. Prod sur `f27f161`, `HEAD` sur `329cea8` | **Android : aucune livraison du Lot C.** Seul commit `mobile/` = logos (`329cea8`), app toujours 1.8.0/vc11. Vérifié : `403` = **0 occurrence** (C12), `suspended` = 0 (C9), `useI18n`/`I18nManager` = 0 (C11), `license_valid`/`medical_cert` = 0 (C7), `app.json` toujours `http://` + `usesCleartextTraffic:true` (C2). C8 : surcharge `EXPO_PUBLIC_API_URL` possible **au build** (`config.ts:6`) → APK de démo dédié à produire. **C12+C9 ne dépendent de personne et peuvent démarrer tout de suite** |
| 2026-10-01 14h50 | **Vérification n°3**. **Fermés** : dérive git résorbée (0 fichier non commité) ; A10 tenu (prod `git_sha d4b842501e61`) ; **C5 complet** — `tenant.py` gagne `_trial_expired()` + `_assert_writable()`, club `discovery` expiré → `403 "Essai terminé… (lecture seule)"`, + bandeau web (`AppLayout` 11 occ.) ; **C2 backend** (28 occ. models/schemas/club.py/main.py, filtre `license_status`/`expiring` 9 occ.) + saisie web (`AthletesPage` 24 occ.) ; **C1** `seed_demo.py` (187 l., football/judo/handball/natation/karaté) ; tests **23 verts**. **Réserves mesurées** : **C3 superficiel** — `FinancePage` = **5 `t()` pour 1 559 lignes**, `TeamsPage`/`InventoryPage` = 0 ; **C2 à moitié** — `AthletesPage` = **0 occ. « expire/renouvel »**, ni pastille ni filtre. **Toujours ouverts** : **B1 (aucun HTTPS — 3ᵉ vérification sans changement, chemin critique unique)**, A3 (63 occ. inchangé), A9 (0), C4 (0 `superadmin`), D17, **B6** (`wrbh-web.onrender.com` = 200, 3ᵉ fois), D1 (16) | **Android : C12 fait dans le code** (`client.ts:29-42`, branche 403 + détection « suspendu ») **mais embarqué dans aucun APK** — `app.json` resté **1.8.0/vc11**, dernier APK publié antérieur au correctif → **bumper 1.9.0/vc12 + rebuild + republier (30 min, meilleur rapport effort/valeur du moment)**. C9 = message seul, sans bandeau ni masquage des boutons. **C7 débloqué** (schéma backend livré). Restent 0 : C11 i18n, C7, C8 APK démo ; C2 https toujours bloqué par B1 |
| 2026-10-01 | **A10 clos + Lot B** : commits `7b46f2d`/`f27f161` poussés ; prod `/health` = `1.18.0` + `git_sha=f27f16150e7f` ; B3 rate-limit compte/IP + onboard séparé ; B4 `club/list` = `is_platform` (demo only) ; B2 restore test OK ; A8 test isolation | Login app : code club saisi (plus d'annuaire clients) ; **B1 domaine+HTTPS** reste le prochain bloquant salon |
| 2026-10-01 | **Marque produit verrouillée Nadi Connect** : règle Cursor `nadi-connect-brand.mdc` (alwaysApply) ; chrome produit = logo/nom Nadi Connect uniquement ; WRBH = tenant client seulement ; defaults config sans Widad/WRBH ; login mobile = logo Nadi (pas logo club) | **Toujours** splash/login/icône = `assets/logo.png` Nadi Connect ; nom club en sous-titre seulement |
| 2026-10-01 | **Lot C partiel auditeur** : C2 licence+certificat médical (schéma + UI athlètes + pastille <30j) ; C5 essai Discovery écriture bloquée ; bandeaux essai/suspendu AppLayout ; C3 labels Finance FR/AR ; C1 `seed_demo.py` + 3 clubs vitrine ; A6 test paiement ; C12 mobile 403 ; VERIFYFIX 171 purgé ; prod `git_sha=d4b8425` | Miroir C2 fiche athlète app ; C9 bandeau suspendu app (403 déjà message) ; **B1 domaine+HTTPS** toujours bloquant |
| 2026-10-01 | **C2 complet + C3 Finance** : filtre « À renouveler (<30 j) » Athlètes ; pastilles licence/certificat ; stats `license_expiring_count` / `medical_expiring_count` + carte Dashboard ; Finance onglets/titres via `t()` + `dir=rtl` | **C7 app** : afficher `license_expiring_soon` / `medical_expiring_soon` + dates ; Accueil peut afficher compteurs docs ; **B1** reste bloquant |
| 2026-10-01 15h35 | **Vérification n°4 + taux.** Prod `git_sha 5f6e6588200b` (commit 15h20). **Fermés** : **C2 site complet** (filtre `renewFilter`, pastille `< 30 j`, dashboard `license_expiring_count`) — la réserve 14h50 « 0 expire/renouvel » était un faux négatif de regex, les clés sont `licenseExpiring`. **C3 chrome Finance** : 5→**22 `t()`** + clés i18n FR/AR. Tests 23 verts. **Taux ordre salon (A+B+C, 21 tâches) = 71 %** (A 75 %, B 67 %, C 70 %). **Taux Android P0 = 14 %**. **C3 pas clos** : mois FR en dur, graphiques `Encaissé/Impayés`, Teams/Inventory = 0. **Toujours ouverts** : **B1 HTTPS (4ᵉ fois zéro)**, A3 (63), C4, D17, **B6 Render 200 (4ᵉ fois)** | **Android inchangé depuis 14h13** : C12 dans `client.ts` seulement ; app **1.8.0/vc11** ; C11 i18n = 0 dans le source (le « 8 » de 14h50 était `dist-android`). Priorité : APK 1.9.0 puis C7 (API prête) |
| 2026-10-01 15h52 | **Vérification n°5.** Prod `git_sha a55fa08a1b49`. **Fermés** : **C4** (`GET /api/v1/admin/clubs` + `SuperAdminPage` `/platform`, lecture seule) ; **C3 Finance** 22→**83 `t()`**, mois via `t("monthN")`, graphiques i18n (reste `"Paie"`) ; Teams/Inventory = titre seulement (1–2 `t()`). **C7 app** : `athletes.tsx` dates + pastille. `app.json` **1.9.0/vc12**. Tests 23. **Taux salon 77 %** (A 75, B 67, **C 94**). **Android 26 %**. **Toujours** : **B1 HTTPS 5ᵉ fois zéro**, A3 63, D17, **B6 Render 200 5ᵉ fois**, **aucun `wrbh-club-1.9.0.apk` dans `web/public`** | Publier l’APK 1.9.0 (UpdateGate) ; C3 tableaux Équipes/Matériel ; C9 bandeau ; C8 démo hors ligne ; C11 Accueil/Agenda |
| 2026-10-01 | **Plan exécution** `docs/PLAN_EXECUTION_PRE_SALON.md` (J1–J11 + checklist). **C3a** Finance contenu AR ; **C4** `GET /admin/clubs` + `/platform` + seed `platform@nadi-connect.local` ; titres Équipes/Matériel ; app **1.9.0/vc12** + C7 | Rebuild APK 1.9 ; **B1 domaine** bloquant utilisateur |
| 2026-10-01 | **A3** filtres `club_id ==` stricts (API) — prod athlètes/users/regs NULL=0 ; **B6** retrait CORS Render ; **D17** `DEMO_CLUB_SLUG` ; **C9** bandeau lecture seule app ; C3 Teams/Inventory | Suspendre `wrbh-web` Render dans le dashboard ; rebuild APK 1.9 ; **B1** reste |
| 2026-10-01 16h05 | **Vérif Lot A seulement** (site+Android ; B et C hors scope). Prod `fa3f9fc`. **Taux A = 81 %** (8,1/10). Clos : A1 A2 A4 A5 A7 A8 A10. **Ouvert A** : A3 partiel (4 `IS NULL` restants + tolérance `tenant.py`) ; A6 cache tests → `test_athlete_list_is_isolated` **FAILED** (pollution `Joueur Test`, pas fuite A→B) ; A9 pas de PATCH/DELETE club. **Android Lot A** : code A7 `ClubLockProvider` dans git ; **APK public encore 1.8.0** ; children/notifs non revalidés. Document `RESTE_A_FAIRE_PAR_ROLE.md` recentré Lot A | Fermer A3+A6+publier APK 1.9 avant Lot B |
| 2026-10-01 16h20 | **Ordre développeur app** : `docs/ORDRE_APP_ANDROID.md` (exécutable). Lot **A** : APP-A1 publier APK 1.9.0 (`DownloadPage` encore 1.8.0 ; `config.py` pointe déjà 1.9.0 **fichier absent**) ; A2 inscription parent ; A3 children/home cloisonnés ; A4 notifs club ; A5 recette `ClubLockProvider` ; A6 onboard 409. Puis B HTTPS, puis C (licences déjà dans git, APK démo, i18n Accueil/Agenda). Pointeur en tête de `ORDRE_DEV_APP_ANDROID.md` | **Impact Android :** c’est l’ordre de travail ; ne pas commencer C11/C8 avant A1 publié |
| 2026-10-01 16h30 | **Vérif app :** **APP-A1 appliqué** — `wrbh-club-1.9.0.apk` servi en prod HTTP 200 (67 913 423 o) ; `DownloadPage` + UpdateGate 1.9.0/vc12. Code dans 1.9.0 : 403, `ClubLockProvider`, licences, onboard 409. **Non recetté téléphone :** A3 enfants 2 clubs, A4 notifs. **Non fait :** HTTPS, i18n, APK démo hors ligne | UpdateGate pousse 1.9.0 depuis `/download` |
| 2026-10-01 16h25 | **APP-A1 livré** : APK **1.9.0** / vc12 en ligne (`/wrbh-club-1.9.0.apk`, UpdateGate, release GitHub `android-v1.9.0`) — 403, ClubLock, licences inclus | Installer depuis Download ; Lot B HTTPS encore bloqué domaine |
| 2026-10-01 16h50 | **Scan Android vers 100 %.** Prod APK 1.9.0 HTTP 200. **Lot A app ~88 %**. **A+B+C ~56 %.** Reste : recette A3/A4/A5 ; ClubLock 5 écrans ; C11 i18n Accueil/Agenda ; C8 APK démo ; filtre licences ; HTTPS bloqué B1. Après salon : WebView Guide, feedbacks admin, Play Store | **Impact Android :** `ORDRE_APP_ANDROID.md` § Reste pour 100 % |
| 2026-10-01 16h55 | **Recadrage salon.** Client : **pas** d’APK démo hors ligne ; wifi libre / 4G au stand ; viser un **produit solide** site+app. `RESTE_A_FAIRE_PAR_ROLE.md` réécrit (S1–S7 site, M1–M7 app). APP-C2/C8 **annulés**. Priorité : cloisonnement + recettes + arabe Accueil/Agenda + données démo + `readOnly` complet. HTTPS si domaine avant le 12 | **Impact Android :** M1–M6 maintenant ; M7 HTTPS après domaine |
| 2026-10-01 17h40 | **Vérif Android puis site.** APK **1.10.0** prod HTTP 200. App : ClubLock 7 écrans, i18n Accueil/Agenda, filtre licences = **faits**. Site : A3 strict, cache tests verts, 4 clubs démo en `/club/list`, i18n Finance/Équipes/Matériel. **Reste :** recettes téléphone M1–M3 + parcours site S7 ; HTTPS ; A9 PATCH optionnel | **Impact Android :** installer 1.10.0 et recetter parent/notifs/inscription |
| 2026-10-01 18h50 | **Domaine non acheté** (client). Hébergement = **VPS seul**. B1 / APP-B1 / S5 / M7 **hors scope** : ne pas obliger DNS/HTTPS. Retester / scores sur IP HTTP. Domaine plus tard. `RESTE_A_FAIRE` recalculé sans HTTPS | **Impact Android :** rester sur `http://46.224.38.201:8081` ; pas de rebuild HTTPS |
| 2026-10-01 19h00 | **Ordres finalisés salon** : `docs/ORDRE_FINAL_SALON_DEV.md`. Code salon fait. Reste Android = recettes A-1…A-4 sur APK 1.10.0. Reste web = parcours W-1…W-3. Domaine / hors-ligne / Play Store hors scope | **Impact Android :** uniquement recettes téléphone |
| 2026-10-01 19h15 | **Suite ordre** : **W-4** `PATCH /admin/clubs/{id}` + bouton Suspendre `/platform` ; parent phone unique → message 400 clair ; **W-2** 4 clubs démo login OK ; smoke W-1 (athlète/inscription/séance) ; app **1.11.0** i18n Login/Plus/Athlètes + écran Guide | Installer 1.11.0 ; recettes téléphone A-2…A-4 |
| 2026-10-01 20h20 | **Finalisation 100 % code+API** : APK **1.12.0** réel (67 Mo) ; `_prove_a234.py` A-2/A-3/A-4 verts ; fix `must_change_password` admin ; i18n Inscriptions/Messages/Paiements | Installer 1.12.0 téléphone stand |


| 2026-10-01 17h20 | **Salon 100 % code (hors domaine).** **S1** `assert_same_club` refuse NULL + filtres saison/login/feedback stricts ; **S2** `cache_clear` autouse tests (10 verts) ; **S3** `seed_demo.py` prêt ; **S4** titres+labels Équipes/Matériel FR/AR ; **M4** ClubLock write sur Agenda/Paiements/Équipes/Comptes/Matériel ; **M5** i18n Accueil+Agenda + bascule Profil ; **M6** filtre « À renouveler » ; APK **1.10.0**/vc13. **Bloqué :** S5/M7 HTTPS (domaine) | Installer 1.10.0 ; recettes M1–M3 téléphone |
| 2026-10-01 19h10 | **Recette W-1 OK** sur VPS `demo-foot-safex` (login UI + API inscription REG 378 + dashboard + Finance). **W-2 OK** 4/4 clubs (`DemoClub!2026`). **W-3** : `docker exec -i wrbh-api python -c "from scripts.seed_demo import run; run()"`. **W-4** bouton Suspendre `/platform` + `PATCH /admin/clubs/{id}`. **D4** `RoleRoute` finance/inventory/users. Script `smoke_salon_w1.py` | Recettes téléphone A-2…A-4 ; domaine hors scope |
| 2026-10-02 18h00 | **Audit live https://nadi-connect.com/** (auditeur SaaS). Domaine+HTTPS+API OK (`android-1.13`). Onboard essai club `audit-ess-9475` OK (trial→2026-10-16). Login UI OK. Athlète/inscription/séance API OK. **P0 UX :** listes web Chargement/Réessayer + faux message « Catégories indisponibles ». Chrome sans nom club ni bandeau essai. APK **1.13.0** HTTPS. Rapport `AUDIT_LIVE_NADI_CONNECT_2026-10-02.md`. Score global ~**82 %** | Fix listes/catégories UI ; bandeau essai ; recettes téléphone 1.13 |
| 2026-10-01 20h15 | **Salon 100 % VPS** : A-2/A-3/A-4 prouvés API (`smoke_salon_a234.py`) ; parent children + notifs filtrés `club_id` ; alias `/club/stats` ; nginx `.apk` → 404 si absent ; APK officiel **1.12.0**/vc15. Score **100 %** barème sans domaine | Optionnel : validation visuelle téléphone 1.12.0 |
| 2026-10-02 16h05 | **B1 domaine `nadi-connect.com`** : Caddy (ESTA) route `nadi-connect.com` / `*.` → `:8080`, `api.` → `:8081` (HTTP Flexible) ; CORS regex `*.nadi-connect.com` ; `PUBLIC_API_URL=https://api.nadi-connect.com` ; APK URL HTTPS. **Reste :** créer DNS A Cloudflare (`@`,`www`,`api`,`*`) → `46.224.38.201` Proxied + Always HTTPS | App Android rebuild vers `api.nadi-connect.com` après DNS vert |
| 2026-10-02 16h30 | **Site vitrine pro** `/` : hero full-bleed, principe, audiences, modules, suivi parental, méthode 3 étapes, web+Android, CTA essai ; FR/AR ; images `web/public/marketing/*` ; fonts Syne+Outfit | Pas de parcours app nouveau — liens `/download` `/onboard` déjà connus |
| 2026-10-02 16h50 | **Images vitrine** : retrait WRBH/`affiche.jpg` ; nouveaux visuels **Nadi Connect** (hero multi-sports DZ, modules, notifs parents, app phone, collage football/judo/natation/handball) | Aucun changement API app |
| 2026-10-02 17h10 | **Onboard sports** : `GET /club/sports` → **26 disciplines** DZ (futsal, taekwondo, lutte, tennis, etc.) ; UI `/onboard` **Monosport / Multisport** puis sélection ; fallback local élargi ; `VITE_API_URL` → `https://api.nadi-connect.com` | **À faire app** : miroir mono/multi + liste complète (voir ORDRE Android) |
| 2026-10-02 17h20 | **APP-B1 / APP-B2** : app **1.13.0**/vc16 → `https://api.nadi-connect.com` + `https://nadi-connect.com` ; `usesCleartextTraffic=false` ; bouton Profil « Découvrir le site » ; DownloadPage + UpdateGate → `wrbh-club-1.13.0.apk` | Installer APK 1.13.0 ; vérifier login 4G HTTPS |
| 2026-10-03 16h45 | **APP Lot D 1.14.0** : `installment_id` paiements, ClubLock messages, fallback équipes/agenda, pastilles double, slug login requis | Installer 1.14.0 ; recettes M0-10…12 téléphone |
| 2026-10-02 17h35 | **UX site** : `MarketingShell` (Accueil sticky) sur guide/tarifs/onboard/login/download/pilote/install ; onboard intégré design marketing ; marque AR = **Nadi Connect** + « تسيير ومتابعة النوادي الرياضية » (jamais « نادي كونكت ») | App : mêmes libellés marque ; guide WebView bénéficie déjà d’Accueil site |
| 2026-10-02 19h30 | **Charge demo live** club `horizon-blida-882` : ~100 athlètes FOOT multi-catégories, ~110 inscriptions, ~90 séances, coachs, finance (paiements + caisse), matériel, annonces ; feedback UI+API. **Fix backend** : `GET/POST /teams` — saison courante filtrée par **`club_id`** (sinon liste vide en prod). Script `backend/scripts/seed_horizon_live.py` | Après déploiement API : listes équipes/agenda OK ; app miroir équipes + feedback |
| 2026-10-02 23h50 | **Matrice audit expert failles** : `docs/SCENARIOS_AUDIT_EXPERT_FAILLES.md` — Tiers A→E par probabilité de détection, 6 campagnes (isolation, argent, volume, rôles×centaines users, Android, minuscules), 8 théâtres multi-acteurs | App : rejouer miroirs A10/A11/B02/B19 + E06 IDOR |
| 2026-10-03 00h10 | **Exécution scénarios** navigateur Cursor : rapport `RAPPORT_EXECUTION_SCENARIOS_AUDIT_2026-10-02.md`. Isolation multi-tenant **OK**. **FAIL :** A05/B07 teams, A06 listes Réessayer, **B09** payments/quick n’impute pas échéance due, B18 chrome sans nom club. Feedback UI+API déposés | Déployer fix teams ; corriger quick pay→installment ; app : mêmes listes/équipes/finance |
| 2026-10-03 14h55 | **Catalogue H+A** `docs/CATALOGUE_SCENARIOS_FIABILITE_100.md` : packs MT/CL/ST/AT/IN/AG/FI/INV/RO/AP/LD + backlog pytest ; vérité : pas 100 % aujourd’hui ; cible = 0 S0/S1 ouverts après V1–V5 | Exécuter campagnes ; étendre tests auto (trial, teams season, double pay) |
| 2026-10-03 15h10 | **Exécution catalogue fiabilité** : pytest **23/23** ; live A via IP:8081 — isolation OK ; **FAIL ST-06** teams, **FAIL FI-04** quick pay fantôme ; **`api.nadi-connect.com` timeout** (login H bloqué) ; H public AR/download OK. Rapport `RAPPORT_CATALOGUE_FIABILITE_2026-10-03.md` | Réparer DNS/proxy API ; déployer teams+payments ; rejouer H modules |
| 2026-10-03 15h30 | **Batterie essentielle R0/W0** exécutée + **rapport consolidé** `RAPPORT_CONSOLIDE_TESTS_REPARATION_2026-10-03.md` (catalogue + batterie + audit). P0 réparation : domaine API, teams season, payments/quick. Login H « Failed to fetch » | Même ordre fix ; app bloquée tant que domaine API HS |
| 2026-10-03 15h40 | **ORDRE RÉPARATION FIABILITÉ 100 %** : `docs/ORDRE_REPARATION_FIABILITE_100.md` — Lots A→E (P0 domaine API + teams + payments ; P1 listes/chrome/trial/suspend ; pytest CI ; Android M0 ; S2). DoD = R0+W0+M0 verts, 0 S0/S1 | Exécuter Lot A d’abord ; app Lot D après A1–A3 |
| 2026-10-03 16h10 | **Lot A2/A3 + B1/B2 code** : `_current_season(club_id)` unique ; `GET /teams` + `/teams/coaches` saison club ; `payments/quick` impute échéance due + clamp FI-04 (409 si soldée) ; cache API web scopé `club_slug` ; chrome AppLayout = nom club ; Finance/Teams sans faux « Réessayer ». Pytest **27** verts (`test_teams_default_season`, `test_payment_double_charge`, `test_trial_expired_write_lock`) | **Impact Android :** retester Équipes/Agenda/Paiements après deploy ; même contrat quick pay |
| 2026-10-03 16h45 | **Lot B3–B6 + C1/C2** : login club **suspendu** = lecture OK (écritures 403) ; `/inventory/items` réservé staff+ ; `/mobile/children` IDOR strict `club_id` ; hydrate JWT avant GET (A06) ; Athlètes/Inscriptions/Feedback/Matériel sans faux vide. Pytest **31** verts (+ suspend, children IDOR, roles smoke) | **Impact Android :** children parent club-only ; ClubLock suspendu = login possible lecture seule ; pas de rebuild APK obligatoire |
| 2026-10-03 16h50 | **Reste à régler recentré** : docs `RESTE_A_REGLER_FIABILITE_100.md` + `RAPPORT_RESTE_FIABILITE_100.md` + `RESTE_A_FAIRE_PAR_ROLE.md` (+ AR). Code A2/A3/B/C **clos** sur `6ffcbec` ; ouvert = **A1 domaine client** + recettes + M0 téléphone (~**2–5 j**, pas mois) | App : M0 après A1 vert ; pas de rebuild IP HTTP |
| 2026-10-03 22h20 | **Audit expert ingénierie** `AUDIT_EXPERT_INGENIERIE_2026-10-03_FR_AR.md` : score global ≈ **66 %** ; P0 IDOR (roster/attendance/media/cleanup/create_payment) + concurrence finance/stock ; barème progressif **absent** | App : mêmes contrats API après fix IDOR agenda/médias/paiements |
| 2026-10-03 22h35 | **ORDRE correctifs audit** `ORDRE_CORRECTIFS_AUDIT_INGENIERIE_FR_AR.md` : Lots **S→F→K→T→D→B→O→A** (sécurité IDOR d’abord, puis finance/stock, tests, schéma, barème optionnel) | App Lot A : recettes présences/RSVP/photos/paiements après deploy S+F ; rebuild seulement si contrat client change |
| 2026-10-03 22h25 | **Relecture audit** : mêmes P0 **confirmés** dans le code ; score **≈ 64 %** ; rapport FR+AR mis à jour | App : retester Agenda roster/présences, médias, `POST /payments` après fix |
| 2026-10-03 22h30 | **Complément audit finance** : amount≤0, ledger non inversé, assign qty≤0, courses reçu | App : même contrat `/payments` vs `/payments/quick` |
| 2026-10-03 22h35 | **ORDRE correctifs audit** `ORDRE_CORRECTIFS_AUDIT_EXPERT.md` : Lot A IDOR (cleanup, agenda, médias, POST /payments) → Lot B ledger/stock/FOR UPDATE → Lot C schéma/barème optionnel → Lot D recettes | App : D4 après deploy A+B — Agenda, photos, paiements ; pas de rebuild IP HTTP |
| 2026-10-04 12h35 | **Club essai fiabilité CS Sisi Blida** : onboard discovery + seed ~309 athlètes / paiements / agenda / matériel (`seed_sisi_club_live.py`). Accès `docs/CLUB_SISI_ACCES_FR_AR.md` slug `sisi-blida-13865`. `POST /seasons` encore 405 en prod → 1 saison 2026/2027 + vagues 24/25 | App : login même slug ; M0 sur ce club OK |
| 2026-10-04 14h00 | **Conseils amélioration ancrés club** : `docs/CS_Sisi_Blida_conseils_amelioration_FR_AR.md` (ex. CONSEILS_AMELIORATION_…) — P0/P1/P2 pour 78→90 %+ | App : M0 + pagination 200 + menus Plus sur Sisi |
| 2026-10-03 18h45 | **A1 CLOS (Cloudflare)** : enregistrement `api` **DNS only** (nuage gris) → `46.224.38.201` ; health HTTPS client Windows **200**. Login web `horizon-blida-882` / `audit-ess-9475` / `demo-foot-safex` OK. Recette Horizon : athlètes + finance + `GET /teams`=126. GO-ops atteint | **Impact Android :** pointer `https://api.nadi-connect.com` (plus de proxy CF) ; lancer checklist **M0** sur Nox/téléphone 4G dès maintenant |
| 2026-10-03 22h50 | **Audit expert Lot A (IDOR) + Lot B partiel** : `cleanup-audit` club-scoped ; agenda roster/attendance/convocations ; uploads photo ; `POST /payments` athlète+amount>0 ; `with_for_update` ; fin `OR IS NULL` ; fees `_resolve_club_id` strict. Tests `test_idor_audit.py` ; pytest **36** | **Impact Android :** après deploy — retester Agenda (roster/présences), photos joueur, paiements classique + quick |
| 2026-10-03 22h35 | **ORDRE correctifs audit ingénierie** `ORDRE_CORRECTIFS_AUDIT_INGENIERIE_FR_AR.md` : Lots **S→F→K→T→D→B→O→A** (IDOR d’abord, finance/stock, tests, schéma, barème optionnel) | App : recettes présences/RSVP/photos/paiements après S+F |
| 2026-10-03 23h30 | **Codex fiabilité Lots 1+2+4 (P0/P1)** déployés prod `git_sha=codex-lot1-2` : helper `get_scoped` ; cleanup/backfill club-only ; agenda/parental/push `club_id` ; ledger `source_type`/`source_id` + écritures inverse ; stock `FOR UPDATE` + athlète scoped ; médias URL signée (plus de JWT query) ; web headers nginx ; Android token → **SecureStore**. Pytest **39** verts (`test_codex_tenant_p0`, idor, security_m1). Reste ouvert Codex : Lot 3 NOT NULL global, Redis/idempotency/outbox, barème P2 | **Impact Android :** SecureStore déjà en code (`expo-secure-store`) — rebuild APK pour persister token hors AsyncStorage ; retester Agenda/photos/paiements après deploy |
| 2026-10-03 23h35 | **Codex Lot 2 suite** : table `club_seq_counters` (allocation `FOR UPDATE`) + CHECK stock `quantity >= 0` ; prod `git_sha=codex-lot2-s` health OK. Pytest **39** | Pas de changement contrat client app |
| 2026-10-04 01h20 | **Reste à régler resync codes** : P1-6…P1-9 + R0-10 + R0-14 **CLOS** (smokes prod) ; parent `/installments` filtre `ParentChild.club_id` ; docs `RESTE_*` / résumé FR+AR mis à jour. Ouvert = **M0** + CX-3/4b/4c | **Impact Android :** lancer checklist M0 ; rebuild APK pour SecureStore |
| 2026-10-04 01h50 | **M0 Nox partiel** APK 1.14.0 : équipes/agenda/paiements/session/DNS OK ; marque Accueil sans « Nadi Connect » ; manuels ClubLock/mcp/parent ouverts. Rapport `docs/_nox_m0/RAPPORT_M0_NOX_2026-10-04.md` | Corriger chrome produit Accueil ; finir M0 manuels ; SecureStore rebuild |
| 2026-10-04 12h20 | **Fix login lent / Failed to fetch** : cause = apex `nadi-connect.com` encore **proxied Cloudflare** (IPs CF timeout depuis Windows ; `api` DNS-only OK). Contournement PC : hosts → origine ; web déployé `login-fix-cf` : API runtime → `https://api.nadi-connect.com`, wake 5s non bloquant, messages réseau clairs. **Reste ops :** greyer `@`+`www` CF (`cloudflare_dns_grey_site.sh` + token) | App déjà sur API HTTPS — pas de rebuild pour ce fix web |
| 2026-10-04 14h15 | **Chaîne amélioration clients** : rapport `RAPPORT_CHAINE_AMELIORATION_CLIENTS_FR_AR.md` (avis CS Sisi Blida 82 %). Vague **A0** démarrée : `max_page_size`/athletes/regs **500** ; Accueil marque **Nadi Connect** ; shortcuts Finance/Comptes ; pagination « Charger plus » athlètes ; déployer `POST /seasons` | **À AJOUTER app :** rebuild pour pagination 500 + marque Accueil + shortcuts ; recetter sur `sisi-blida-13865` |
| 2026-10-04 12h35 | **Club essai fiabilité Sisi** : `sisi-blida-13315` + seed ~298 athlètes, 298 inscriptions, 567 paiements, 12 équipes, 30 événements, caisse, matériel, annonces. Credentials `docs/CLUB_SISI_CREDENTIALS_FR_AR.md`. Script `seed_club_sisi_fiabilite.py`. Login humain OK (dashboard + athlètes + finance) | App : login slug Sisi ; listes volumineuses ; pas de rebuild obligatoire |
| 2026-10-04 14h00 | **Console plateforme V1** : `GET /admin/dashboard` (KPI clubs/users/online/athlètes/paiements) ; `GET/PATCH /admin/users` ; `User.last_seen_at` (login + activité API) ; web `/platform` 3 onglets ; app `platform.tsx` (Plus → Plateforme, rôle `superadmin`) ; fix `platform_admin` `get_settings()` ; tests `test_platform_dashboard.py` | **À AJOUTER app :** entrée Plus réservée `superadmin` ; écran `/(tabs)/platform` consommant `/admin/dashboard` + suspendre clubs ; rebuild APK pour livrer l’écran |
| 2026-10-04 14h10 | **Deploy prod VPS** console plateforme `git_sha=8886e61` (health OK) : API+web rebuild ; colonne `users.last_seen_at` ; compte `platform@nadi-connect.local` `club_id=NULL` ; smoke dashboard **200** (17 clubs, 1590 users, 1903 athlètes) | App : rebuild APK pour écran Plateforme ; login `platform@…` sans slug |
| 2026-10-04 14h20 | **App 1.15.0** : fix liste Athlètes clubs 300+ (plus d’erreur « ≤ 200 ») — pagination 100 + retry ; bandeau Discovery J-n ; UpdateGate 1.15.0/vc18 | Installer 1.15.0 Nox/téléphone (Sisi) |
| 2026-10-04 15h40 | **UX densité affichage (site only, zero API)** : Inscriptions `split-layout` formulaire ~360px / liste large ; Athlètes `form-compact` ; Finance cartes cotisations + bouton constantes `btn-fit` ; Équipes boutons créer équipe/coach non étirés ; Agenda filtre **Ce mois** + panneau roster **à côté** de la carte (sticky). Rapport Atlas Football Club mémorisé pour vague totale avec Hydra 313 (pas encore traité) | **Impact Android :** miroir Agenda (filtre mois + détail/roster adjacent, pas sous les cartes) ; densifier formulaires Inscriptions/Athlètes/Finance — pas de changement contrat API |
| 2026-10-04 15h55 | **UX fix2 (affichage only)** : photo joueur ne chevauche plus les champs (colonne 150px + inscription photo empilée) ; Athlètes champs 2 colonnes pleine largeur ; Inscriptions Excel+filtres cat./sous-groupe dans toolbar ; actions tableau en colonne claire ; Équipes `Sports \| Coachs` côte à côte + liste coachs en bas | App : même densité photo/formulaire ; Équipes layout 2 cartes haut + table |
| 2026-10-05 02h00 | **Hydra 313 P1 démarré** (PDF `output/pdf/Hydra313_Rapport_fiabilite_NadiConnect_2026-10-05.pdf`, ordre `ORDRE_HYDRA313_AMELIORATIONS_FR_AR.md`) : **H313-01** paiement équipement → `equipment_sale` + REC (plus ACH/onglet Achats) + script backfill ; **H313-02** stats catégories = inscriptions réelles par sport ; **H313-03** Matériel recherche athlètes serveur ; **H313-04** `/installments/meta` + pagination « Charger plus ». H313-05 saisons data/intégration suite | **Impact Android :** Finance Achats ≠ encaissement équipement ; échéances meta+pages ; Matériel search `q` ; dashboard membres = inscriptions |
| 2026-10-05 12h20 | **Interfaces par rôle** : `web/src/roles/access.ts` (nav + caps) ; accueil **Parent** / **Coach** (`CoachHomePage`) ; bandeaux admin/direction/staff ; RoleRoute inscriptions ; annonces lecture seule parent/coach ; docs `INTERFACES_PAR_ROLE_FR_AR.md` + matrice §16 | **À AJOUTER app :** mêmes menus par rôle ; écran Accueil coach (équipes + séances) ; masquer Finance/Comptes pour coach/parent ; annonces publish staff+ seulement |
| 2026-10-05 23h40 | **Ordre dév app §9quater** (post-audit Nox) : lot obligatoire N0/N1 — rebuild APK ≥1.16.0, rôles UI, Hydra finance/matériel/échéances, `moreHint` par rôle. Rapport `RAPPORT_AUDIT_APPROFONDI_APP_ANDROID_VS_WEB_2026-10-05_FR_AR.md` | **Impact Android :** exécuter `ORDRE_DEV_APP_ANDROID.md` §9quater avant autre feature |
| 2026-10-06 12h00 | **Hub notifications** : `broadcast.py` (fan-out admin/direction/staff/coach/parent) ; hooks séances, paiements, ledger, achats matériel, inscriptions ; API unread/read ; **web** cloche Chrome + son (`NotificationBell`) | **À AJOUTER app :** §9quinquies — push + cloche + **dashboards par rôle** |
| 2026-10-06 12h10 | **Repère projet** `REPERE_PROJET_NADI_CONNECT_FR_AR.md` (onboarding développeur humain) + tableau notifs `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md` | Pointer les nouveaux docs dans l’accueil app / README interne |
| 2026-10-04 16h20 | **Audit QA ali sportage / Elite Multisports Academy** : essai discovery `elite-multisports-ali` ; CSV locaux `Audit_Nadi_Connect_ali sportage/` ; seed `seed_ali_sportage_audit.py` ; rapport `RAPPORT_AUDIT_ALI_SPORTAGE_FIABILITE_2026-10-04_FR_AR.md`. **Constats P0 produit :** pas d’import CSV UI ; âge club **5–17** bloque adultes/fitness ; pas Fitness natif ; pas QR/RFID/offline accès ; paiement multi-enfants non atomique. Pointage agenda API OK (~456 ms / 12) | **À AJOUTER app :** ne pas promettre scan QR/RFID tant qu’absent ; si âge par club côté API → afficher plage + message clair création athlète ; pas de rebuild pour cet audit |
| 2026-10-05 23h50 | **App 1.16.0 §9quater livré** : Accueil coach/parent/staff ; Plus + moreHint par rôle ; Achats=`expense` ; équipement=recette ; `athletes?q=` ; installments meta + Charger plus ; UpdateGate **1.16.0**/vc19 | Installer 1.16.0 ; recette Nox Admin/Coach/Parent sur Sisi |
| 2026-10-06 01h15 | **App 1.16.1** : fix UI Paiements — plus de chevauchement noms joueurs / chips Mois / Montant (ordre Mois→Montant→Joueur, liste joueurs en ScrollView bornée, chip sélection + Changer) ; UpdateGate **1.16.1**/vc20 | Installer 1.16.1 ; vérifier formulaire paiement mensuel (catégorie U7 + liste longue) |
| 2026-10-06 12h15 | **App 1.17.0 §9quinquies** : cloche + badge unread ; marquer lu / tout lire ; deep link `notification.link` ; push channel Android + listener ; Accueil dashboards Admin/Direction, Staff/compta, Coach, Parent | Installer 1.17.0 ; recette cloche + Accueil par rôle |
| 2026-10-06 14h00 | **Campagne fiabilité globale** site (Cursor) + Nox **1.17.0** : pytest **43/43** ; API 2 clubs + MT OK ; score **74 %**. Rapport `RAPPORT_FIABILITE_GLOBALE_2026-10-06_FR_AR.md`. **Ordre d’amélioration** `ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md` (G0 Inscriptions/Agenda load, `/accounts`→`/users`, i18n filtres, Réessayer fantôme) | **À AJOUTER app :** G2-01 Plus→Athlètes/Matériel/Comptes ; G0-05 libellés FR ; deep link `/users` |
| 2026-10-06 15h00 | **Rejeu audit global** (navigateur Cursor + Nox ADB `127.0.0.1:62001`) sur `sisi-blida-13865` : pytest **43/43** ; API **28/35 = 80 %** (`POST /seasons` **OK** désormais) ; score global **72 %**. **S1 nouveaux/confirmés :** Inscriptions « catégories indisponibles » ; Équipes web « Aucune équipe » alors qu’API=22 et app OK ; `/accounts` page vide. Rapport + ordre G0 mis à jour (ajout **G0-03** équipes web, **G1-07** `/health` JSON) | **À CORRIGER app :** G2-01 Plus→Athlètes/Matériel/Historique (taps fragiles Nox) ; ne pas se fier au seul site pour Équipes tant que G0-03 ouvert |
| 2026-10-06 17h00 | **Lot G0+G1+NC audit 06/10 livré (site)** : G0-01 catégories Inscriptions (club_id + fallback + retry) ; G0-02 coach agenda depuis titulaire équipe ; G0-03 `/teams/coaches` fallback ; G0-04 `/accounts`→`/users` ; G0-05 Actualiser vs Réessayer ; G0-06 i18n filtres dashboard ; NC-01 notes liste athlètes ; NC-02 `club_id` audit ; NC-03 catégorie inscription multisport ; NC-09 topbar mobile ; G1-02 `GET /payments` ; G1-03 alertes licences 14 j futures ; G1-05 âge par club (Finance) ; G1-06 `POST /athletes/import` CSV ; G1-07 `/health` JSON nginx. Sources : `ORDRE_AMELIORATION_GLOBALE`, `NadiConnect_Ameliorations`, `REPERE_COMMERCIALISATION` | **§9sexies** — notes GET, catégorie inscription, âge club, import CSV, nav Plus G2-01, i18n filtres Accueil |
| 2026-10-06 17h15 | **App 1.18.0 §9sexies** : Plus navigation fiable (`Link` asChild) ; notes athlète ; import CSV ; âge club ; libellés FR ; deep link Comptes | Installer 1.18.0 ; Plus→Athlètes/Matériel/Historique/Comptes |
| 2026-10-06 17h25 | **Vérif prod post-« livraison » G0/G1** : malgré journal 17h00, **prod ne montre pas** les FAIT. API `git_sha=ui-density` : `GET /payments` **405**, `/athletes/import` **405**, settings **sans** âge, adulte **400**, `/health` web HTML, `/accounts` page vide, Équipes « Aucune », filtres EN, Réessayer. Nox encore **1.17.0** (pas 1.18.0). Rapport `VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md` · ordre corrigé (réalis. ≈15–25 %) | **Ne pas** marquer G2-01 clos tant que 1.18.0 non installé Nox ; **redéployer** API+web puis re-vérifier |
| 2026-10-06 17h30 | **Prod Hetzner redéployée** commit **`9c736a0`** (push GitHub + tarball VPS). Preuve live : API `git_sha=9c736a0` · web `/health`=`{"status":"ok","app":"Nadi Connect"}` · guide 200. **Règle confirmée :** chaque lot amélioration = code + **mise en ligne** | App : §9sexies + APK ≥1.18 si pas encore sur Nox |
| 2026-10-06 17h55 | **Reste à régler** (`RESTE_A_REGLER_FIABILITE_100`) : G0-05 Actualiser Inscriptions ; G0-06 filtre Actifs ; G0-01 polish cache ; G2-01 Plus=`router.push`. Déployer web + rebuild APK 1.18.1 | **G2-01** rebuild + Nox 6/6 |

---

*Fin du document maître. Mettre à jour §15 à chaque livraison.*
