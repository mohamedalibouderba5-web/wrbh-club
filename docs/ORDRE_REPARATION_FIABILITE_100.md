# ORDRE DÉVELOPPEUR — Réparation & fiabilité ~100 % (Nadi Connect)

**Date :** 2026-10-03  
**Destinataires :** développeur système / API · développeur web · développeur Android  
**Source de vérité des FAIL :** `docs/RAPPORT_CONSOLIDE_TESTS_REPARATION_2026-10-03.md`  
**Compléments :** `BATTERIE_TESTS_FIABILITE.md` · `CATALOGUE_SCENARIOS_FIABILITE_100.md` · `SCENARIOS_AUDIT_EXPERT_FAILLES.md`  
**Marque :** toujours **Nadi Connect** (jamais WRBH comme produit).  
**Prod :** VPS Hetzner `/opt/wrbh-club` · ports 8080 web / 8081 API · domaine `nadi-connect.com` / `api.nadi-connect.com`.

---

## 0. Objectif & définition du « 100 % »

| Affirmation | Ordre |
|-------------|--------|
| « 100 % zéro bug absolu » | **Impossible à prouver** — ne pas le promettre. |
| « 100 % fiabilité métier revendiquée » | **Cible obligatoire :** 0 FAIL **S0**, 0 FAIL **S1** ouverts sur prod + R0/W0/M0 verts. |
| GO commercialisation / salon | **Interdit** tant que le §1 Lot A n’est pas **100 % OK rejoué**. |

**DoD global (cocher avant de déclarer « fiable ») :**

- [ ] `https://api.nadi-connect.com/health` → 200, `app=Nadi Connect`
- [ ] Login web 2 clubs (Horizon + Audit) sans « Failed to fetch »
- [ ] Tier **R0** batterie 100 % OK (sauf SKIP documentés avec ticket)
- [ ] Tier **W0** 100 % OK navigateur
- [ ] Tier **M0** 100 % OK téléphone 4G
- [ ] `pytest backend/tests -q` vert en CI
- [ ] Aucun S0 ouvert ; S2/S3 listés et acceptés explicitement
- [ ] Journal `ORDRE_LOGICIEL_MAITRE.md` §15 + impact Android mis à jour

---

## 1. LOT A — P0 (bloquants) — faire **dans cet ordre**, sans sauter

Durée indicative : **1–2 jours**. Stop commercialisation jusqu’à A1–A3 verts.

### A1 — Domaine API HTTPS (ops + config)

| | |
|--|--|
| **IDs** | R0-01b · W0-03 · AP-01 |
| **Symptôme** | `api.nadi-connect.com` timeout ; login web « Failed to fetch » ; IP `:8081` OK |
| **Ordre** | 1) Vérifier DNS Cloudflare `api` → `46.224.38.201` (Proxied + Always HTTPS). 2) Vérifier Caddy/ESTA : `api.nadi-connect.com` → `:8081`. 3) Certificat TLS valide. 4) CORS autorise `https://nadi-connect.com` et sous-domaines. 5) Smoke : `GET https://api.nadi-connect.com/health` puis login UI. |
| **Ne pas** | Pointer l’app/web vers HTTP IP en prod « pour dépanner ». |
| **Recette** | Navigateur Cursor : login `horizon-blida-882` + `audit-ess-9475` → dashboard. |
| **Responsable** | Système / DevOps |

### A2 — Équipes : saison courante **par club**

| | |
|--|--|
| **IDs** | ST-06 · R0-11 · W0-06 · W0-07 · A05 · B07 · M0-10 · M0-11 |
| **Symptôme** | `GET /teams` = `[]` ; `GET /teams?season_id=` OK ; UI « Aucune équipe » ; agenda sans équipes |
| **Ordre code** | Dans `backend/app/api/club.py` (et tout endroit encore fautif) : **jamais** `Season.is_current` sans `Season.club_id == club_id`. Auditer aussi `list_teams_with_coaches`, sync-structure, stats, events fallback saison (~lignes encore globales). |
| **État local** | Correctif partiel déjà amorcé sur `list_teams` — **vérifier exhaustivité + déployer** prod. |
| **Tests à ajouter** | `backend/tests/test_teams_default_season.py` : 2 clubs, chacun `is_current` ; `GET /teams` sans param retourne les équipes du club du token. |
| **Recette** | Club essai : POST team → GET `/teams` sans param **non vide** ; UI `/teams` + `/agenda` select équipe rempli. |
| **Impact Android** | Même contrat API ; retester Équipes + Agenda après deploy. |

### A3 — Finance : `payments/quick` impute l’échéance due

| | |
|--|--|
| **IDs** | FI-03 · FI-04 · R0-12 · W0-08 · B09 · M0-12 |
| **Symptôme** | Quick pay 200 mais crée **nouvel** `installment_id` ; `amount_paid` de l’échéance due reste 0 |
| **Ordre code** | Localiser handler `POST /payments/quick`. Si `installment_id` fourni → **créditer cette ligne** (clamp au reste dû). Interdire création silencieuse d’une 2ᵉ échéance « inscription ». Double paiement : soit refuse (409), soit solde cohérent **sans** surpaiement silencieux. |
| **Tests à ajouter** | `test_quick_payment_imputes_existing_installment` · `test_double_quick_payment_no_overpay` dans `test_payment_flow.py`. |
| **Recette** | Échéance due ECH/… ; 2× quick 100 DA → `amount_paid` += 200 ; **même** `installment_id` ; dashboard cohérent. |
| **Impact Android** | Écran Paiements : même comportement. |

### A4 — Déploiement + smoke post-deploy (obligatoire après A1–A3)

```text
1. git pull sur VPS /opt/wrbh-club
2. rebuild api (+ web si besoin)
3. GET https://api.nadi-connect.com/health  → git_sha nouveau
4. powershell scripts/run_batterie_essentielle_clean.ps1  (ou équivalent IP puis domaine)
5. Navigateur : login → équipes → agenda → finance encaissement
6. Feedback admin : confirmer absence de nouvelles erreurs auto critiques
```

---

## 2. LOT B — P1 (fiabilité UX + cycle de vie)

Après Lot A vert. Durée : **1–2 jours**.

### B1 — Listes web « Chargement / Réessayer » (W0-04 / A06)

| Ordre | Détail |
|-------|--------|
| Cause probable | Race : fetch listes avant token/bootstrap prêt ; cache stale |
| Fix | Attendre auth hydratée ; retry auto 1× sur 401→refresh ; ne pas afficher « Catégories indisponibles » si `/categories` 200 |
| Fichiers typiques | `web/src/api/client.ts`, pages Athlètes / Inscriptions / Finance / History / FeedbackAdmin |
| Recette | Cold load 5 modules : données visibles **sans** clic Réessayer |

### B2 — Chrome : nom du club (W0-09 / B18)

| Ordre | Détail |
|-------|--------|
| Fix | Sous-titre shell = **nom du club** (ex. Club Horizon Blida) ; titre produit reste **Nadi Connect** + logo Nadi |
| Fichier | `web/src/layouts/AppLayout.tsx` (ou équivalent) |
| Recette | Login essai → chrome lit Nadi Connect + nom club |

### B3 — Essai expiré write-lock (R0-08 / CL-06 / M0-07)

| Ordre | Détail |
|-------|--------|
| Fix API | Confirmer `_trial_expired` + `_assert_writable` sur **toutes** écritures |
| Fix UI | Bandeau + masquage créations (déjà partiel) |
| Test | Club discovery `trial_ends_on` passé → POST athlete **403** ; GET OK |
| Pytest | `test_trial_expired_blocks_write.py` |

### B4 — Club suspendu (R0-07 / CL-07 / M0-08)

| Ordre | Détail |
|-------|--------|
| Fix | Écritures 403 partout ; lecture OK ; bandeau web + `ClubLockProvider` app |
| Recette | Superadmin suspend → staff ne crée plus ; réactivation → write OK (CL-08) |

### B5 — Matériel UI stock vide alors API OK

| Ordre | Détail |
|-------|--------|
| Fix | `/inventory` : charger `/inventory/items` après auth ; peupler selects article/joueur |
| Lié | B1 race listes |

### B6 — Sports club « Aucun sport configuré » sur club multisport

| Ordre | Détail |
|-------|--------|
| Fix | Page équipes : lire disciplines du club (bootstrap) ; ne pas afficher faux vide |
| Recette | Horizon FOOT+JUDO+NATA visibles |

---

## 3. LOT C — P1/P2 (métier, rôles, couverture auto)

### C1 — Pytest régressions critiques (CI)

Créer / étendre dans `backend/tests/` :

1. `test_teams_default_season.py` ← A2  
2. `test_payment_double_charge.py` ← A3  
3. `test_trial_expired_write_lock.py` ← B3  
4. `test_mobile_children_idor.py` ← R0-13  
5. Étendre `test_roles_matrix_smoke.py` (20 cases matrice)

**CI :** `pytest tests/ -q --tb=short` sur chaque PR.

### C2 — Matrice rôles (RO / W0-11 / B02–B04)

| Ordre | Détail |
|-------|--------|
| Parent | Pas Finance / Comptes / Matériel (UI + API 403) |
| Coach | `must_change_password` forcé (OK) ; scope équipes ; pas create inscription si matrice = — |
| Documenter | Écarts matrice vs API dans `MATRICE_ROLES_ACCES.md` si volontaires |

### C3 — Agenda parental (AG-05…07)

Start → présence → notif absence ; cancel + notify ; prefs parent OFF respectées.

### C4 — Rate-limit hygiène

Ne **jamais** lancer R0-10 sur comptes démo salon ; user jetable. Documenter fenêtre 429.

### C5 — Onboard mono/multi (CL-01/02) smoke prod

Après A1 : 1 club mono + 1 multi via UI ; catégories seedées.

---

## 4. LOT D — Android (parité) — **après A1**

Voir aussi `ORDRE_DEV_APP_ANDROID.md`.

| ID | Ordre développeur app |
|----|------------------------|
| AP-01 / M0-02 | Confirmer `apiUrl=https://api.nadi-connect.com` ; rebuild seulement quand A1 vert |
| M0-10/11 | Équipes/Agenda après fix A2 |
| M0-12 | Paiements après fix A3 |
| M0-07/08 | ClubLock essai/suspendu (miroirs B3/B4) |
| M0-04…06 | Login slug, session, must_change_password |
| M0-15/18 | i18n FR/AR ; version = 1.13.x alignée `/download` |
| M0-16 | Feedback `POST /feedback/report` |

**Pas de suite Jest/Detox :** recettes téléphone obligatoires checklist M0.

---

## 5. LOT E — Améliorations S2/S3 (après P0/P1)

| ID | Travail |
|----|---------|
| AT-04 / B14 | Pastille licences &lt;30 j + filtre + stats (web+app) |
| AT-07 / LD-04 | Pagination 100+ sans doublons |
| C07 / CL-12 | Audit i18n FR↔AR ; ne jamais traduire « Nadi Connect » |
| W2-05 | CORS origine random refusée |
| HI-01 | Historique create/pay/archive complet |
| FB-01 | Feedback UI → liste admin sans Réessayer obligatoire |
| D* / E* | Fuseaux, accents, IDOR JWT — campagne minuscules ½ j |

---

## 6. Plan de jours (ordre d’exécution)

| Jour | Lot | Livrable |
|------|-----|----------|
| **J0** | A1 | `api.nadi-connect.com/health` 200 + login web |
| **J1** | A2 + A3 + A4 | Teams + payments déployés ; smoke R0-11/12 OK |
| **J2** | B1 + B2 + B5 + B6 | UX listes + chrome + matériel + sports |
| **J3** | B3 + B4 + C1 | Trial/suspend prouvés + pytest nouveaux |
| **J4** | C2 + C3 + C5 | Rôles + agenda parental + onboard |
| **J5** | D (Android M0) | APK retest 4G |
| **J6** | E + rejeu catalogue complet | Rapport « fiabilité » daté |

---

## 7. Ordre de rejeu obligatoire (après chaque lot)

1. `pytest backend/tests -q`  
2. `run_batterie_essentielle_clean.ps1` (préférer **domaine** HTTPS une fois A1 OK)  
3. Navigateur Cursor : W0-01…W0-15  
4. Si touch Android : checklist M0 téléphone  
5. Mettre à jour :
   - `RAPPORT_CONSOLIDE_TESTS_REPARATION_*.md` (nouvelle date) **ou** append journal  
   - `ORDRE_LOGICIEL_MAITRE.md` §15  
   - `ORDRE_DEV_APP_ANDROID.md` si API/parcours app  
   - `CATALOGUE_SCENARIOS_FIABILITE_100.md` §15 journal  

Chaque FAIL restant → `POST /feedback/report` + ligne dans le rapport.

---

## 8. Répartition rôles développeurs

| Rôle | Lots |
|------|------|
| **Système / API** | A1 (avec ops), A2, A3, B3, B4, C1, C3 |
| **Web** | B1, B2, B5, B6, W0 recettes, C2 UI, C5 |
| **Android** | Lot D entier après A1–A3 |
| **QA / Auditeur** | §7 rejeu ; ne pas marquer OK sans preuve |

---

## 9. Interdits

- Déclarer « 100 % » sans R0+W0 verts sur **domaine** HTTPS.  
- Contourner A1 en hardcodant IP HTTP dans l’APK/web prod.  
- Merger A2/A3 sans pytest de régression.  
- Lancer rate-limit R0-10 sur comptes salon.  
- Renommer le produit hors **Nadi Connect**.

---

## 10. Journal de cet ordre

| Date | Note |
|------|------|
| 2026-10-03 | Création ordre complet Lots A→E depuis rapport consolidé + batteries. |
| 2026-10-03 16h10 | **A2+A3+B1+B2 code** + pytest teams/payments/trial (27 verts). A1 : `api.nadi-connect.com/health` OK via fetch Cursor (timeout intermittent depuis Windows). Deploy A4 suivant. |

---

*Fin de l’ordre. Le développeur exécute Lot A d’abord ; toute livraison hors ordre doit justifier le décalage.*
