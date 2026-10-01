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
| Comptes & rôles | Admin, direction, staff, coach, parent |
| Traçabilité | Historique / corbeille (restauration) |
| Communication | Annonces, messages, notifications in-app |

**Client payeur :** le club. **Utilisateurs quotidiens :** direction, coachs, parents.

---

## 2. Rôles (résumé)

| Rôle | Code API | Qui |
|------|----------|-----|
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

\* Parent : pas le menu Finance complet ; peut voir cotisations liées via inscriptions / profil app.

---

## 4. Tableau de bord

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
| 2026-09-30 | Marque produit **Nadi Connect** (نادي = club) + logo + page `/pricing` (Discovery / Club / Academy) | Afficher Nadi Connect (pas WRBH comme nom produit) |
| 2026-10-01 | **Règle synchro** officialisée : parallèle site/app OK ; chaque livraison → §15 + `ORDRE_DEV_APP_ANDROID` (ajouts + schémas) | Lire §0 + ordre Android §10 |
| 2026-10-01 | **Landing** publique `/` (invité) + script démo `DEMO_SCRIPTEE_NADI_CONNECT.md` | Lien « Site / Offres » optionnel ; splash = Nadi Connect |
| 2026-10-01 | **Athlètes** : N° joueur = `list_number` (aligné Inscriptions), plus l’id DB (268…) ; Kit affiché | Afficher `list_number` / kit, pas `athlete.id` |
| 2026-10-01 | **Dashboard** : saison courante **par club** + cache bootstrap club-scoped ; graphes ne restent plus vides à tort | Rafraîchir Accueil / home stats |
| 2026-10-01 | **Fix bootstrap** : appels `list_categories` / `finance_dashboard` (Fail to fetch / graphes vides) | N/A API — recharger dashboard |
| 2026-10-01 | **Guide formation** `/guide` + `GUIDE_FORMATION_NADI_CONNECT.md` (tous rôles) | Lien optionnel « Guide » / WebView |
| 2026-10-01 | **Guide enrichi** : 16 chapitres, étapes, à faire / à ne pas faire, check-lists, dépannage, recherche | Miroir contenu formation (C3) |
| 2026-10-01 | **Étape 7 pilotes** : `PILOTES_COMMERCIAUX.md` + page `/pilote` + CTA landing/pricing | Lien optionnel « Devenir pilote » |
| 2026-10-01 | **AUDIT commercialisation** (`AUDIT_COMMERCIALISATION_2026-10-01.md`) : tests réels en prod. **P0-1 `POST /registrations` = HTTP 500 pour tous les clubs** (`ensure_parent_account()` reçoit `club_id` non déclaré dans `parents.py` de HEAD — correctif local non commité). P0-2 comptes parents créés `club_id=NULL` → visibles par tous les clubs (prouvé : 5 parents de test apparaissent chez WRBH). P0-3 prod en HTTP sans domaine → `isSecureContext=false`, PWA/service worker inopérants. P0-4 sauvegarde non automatisée. P0-5 onboard 500 si téléphone admin déjà pris (`users.phone` unique global) | **Inscription app Android également en panne** (même endpoint) ; après fix HTTPS → `app.json` en `https://` + retirer `usesCleartextTraffic` ; vérifier `GET /children` après cloisonnement parents |

---

*Fin du document maître. Mettre à jour §15 à chaque livraison.*
