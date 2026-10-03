# Catalogue des scénarios de fiabilité — Nadi Connect

**Date :** 2026-10-03  
**Rôle :** architecte / QA — document **opérationnel** pour testeur **humain (H)** et **non-humain (A)**  
**Complète :** `docs/SCENARIOS_AUDIT_EXPERT_FAILLES.md` (Tiers A–E) · `docs/MATRICE_ROLES_ACCES.md` · `docs/RAPPORT_EXECUTION_SCENARIOS_AUDIT_2026-10-02.md`

---

## 0. Vérité sur le « 100 % »

| Affirmation | Verdict honnête |
|-------------|-----------------|
| « Le système est fiable à 100 % aujourd’hui » | **Non.** Des campagnes d’audit (2026-10-02) ont déjà trouvé des **FAIL** (équipes sans `season_id`, listes UI « Réessayer », paiements vs échéances). |
| « On peut *viser* 100 % de fiabilité » | **Oui**, comme **cible d’ingénierie** : zéro faille S0 ouverte + zéro S1 bloquant métier en prod. |
| « Tous les scénarios = preuve absolue d’absence de bugs » | **Non.** Les tests prouvent la présence de défauts, jamais l’absence totale. On approche 100 % par **couverture + rejeu + isolation multi-tenant**. |
| « Combien de scénarios faut-il ? » | **~180 scénarios unitaires** déjà listés (A–E) + **packs métier** ci-dessous (~120 cas d’exécution). Total opérationnel **~300 passes** si on décline rôles × clubs × volume. |

**État automatisé actuel (backend) :** ~6 fichiers pytest (multi-tenant, login/IDOR, inscription, paiement quick, notifs role). **Gaps majeurs :** agenda complet, trial expiré, finance ledger, inventaire, matrice rôles case-by-case, mobile, UI.  
**App mobile :** 0 suite de tests automatisés dans le repo.

---

## 1. Comment utiliser ce catalogue

| Colonne | Signification |
|---------|----------------|
| **ID** | Identifiant stable (référencer dans feedback / tickets) |
| **H** | Scénario pour testeur humain (UI web et/ou téléphone) |
| **A** | Scénario pour automate (pytest / smoke API / script) |
| **Attendu** | Critère de succès — sinon = **FAIL** |
| **Sévérité** | S0 sécurité/argent · S1 métier bloqué · S2 confiance · S3 cosmétique |

**Ordre imposé :** Isolation multi-tenant → Argent / essai → Métier volume → Rôles → Android → Cosmétique.

**Clubs de campagne :** au moins **2 clubs** (A et B) + **1 club neuf onboard** par vague. Ne jamais tester l’isolation sur un seul tenant.

**Preuve :** chaque FAIL → capture / log API + `POST /feedback/report` + ticket.

Référentiel détaillé détection failles (probabilités) : **`SCENARIOS_AUDIT_EXPERT_FAILLES.md`** (A01–E15).  
Ce document ajoute les **packs métier exhaustifs** + **affectation H/A**.

---

## 2. Pack SÉCURITÉ & MULTI-TENANT (priorité absolue)

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| MT-01 | Club B liste athlètes / GET id club A | ✓ | ✓ | 404 / liste sans A | S0 |
| MT-02 | Idem inscriptions, events, ledger, inventory, users | ✓ | ✓ | Isolation totale | S0 |
| MT-03 | Parent club A : enfants / notifs / payments club B | ✓ | ✓ | Aucune donnée A | S0 |
| MT-04 | Login email club A + **slug club B** | ✓ | ✓ | Refus clair ou token club A seulement — jamais B | S0 |
| MT-05 | JWT claim `club_id` falsifié | — | ✓ | 401 | S0 |
| MT-06 | IDOR incrémental `/athletes/{id+1}` cross-club | — | ✓ | 404 | S0 |
| MT-07 | Notifs séance A visibles inbox B | ✓ | ✓ | 0 croisement | S0 |
| MT-08 | Téléphone parent déjà utilisé autre club | ✓ | ✓ | 400/409 message clair, pas 500 | S1 |
| MT-09 | Téléphone admin doublon onboard | ✓ | ✓ | 409 | S1 |
| MT-10 | Club `is_platform` seul en `GET /club/list` public | ✓ | ✓ | Pas de clients payants listés | S0 |
| MT-11 | 3 clubs × créations parallèles athlètes | ✓ | ✓ | Pas de croisement IDs | S0 |
| MT-12 | CORS origine inconnue | — | ✓ | Rejet navigateur | S0 |

**Automate référent :** `backend/tests/test_multitenant.py`, `test_security_m1.py`, `test_notify_role_isolation.py`.

---

## 3. Pack CYCLE DE VIE CLUB (essai / suspend / onboard)

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| CL-01 | Onboard **monosport** (1 sport) | ✓ | ✓ | 1 discipline + catégories seed | S1 |
| CL-02 | Onboard **multisport** ≥3 sports | ✓ | ✓ | N disciplines + catégories chacune | S1 |
| CL-03 | Onboard slug déjà pris | ✓ | ✓ | 409 | S1 |
| CL-04 | Onboard email admin déjà pris | ✓ | ✓ | 409 | S1 |
| CL-05 | Essai 14 j : bandeau J-n web + app | ✓ | — | Cohérent | S2 |
| CL-06 | `trial_ends_on` passé : POST athlete → 403 ; GET OK | ✓ | ✓ | Write lock, read OK | S1 |
| CL-07 | Club **suspendu** : toutes écritures 403 ; UI bandeau | ✓ | ✓ | Idem | S0 |
| CL-08 | Réactivation après suspend : write OK | ✓ | ✓ | Restaure droits | S1 |
| CL-09 | Rate-limit onboard / login 429 | ✓ | ✓ | Message lisible, pas de boucle | S1 |
| CL-10 | Sports API ≥20 + fallback UI | ✓ | ✓ | Liste complète | S2 |
| CL-11 | Accueil sticky sur guide/tarifs/onboard | ✓ | — | Navigation OK | S2 |
| CL-12 | Marque AR = « Nadi Connect » + définition utilité | ✓ | — | Jamais « نادي كونكت » comme nom produit | S2 |

---

## 4. Pack STRUCTURE : saisons, sports, catégories d’âge, équipes

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| ST-01 | Créer / basculer saison courante | ✓ | ✓ | Une seule `is_current` | S1 |
| ST-02 | Ajouter discipline mid-saison | ✓ | ✓ | Catégories seedées | S1 |
| ST-03 | Créer catégories U7…U17 + Seniors (combat) | ✓ | ✓ | Codes `FOOT-U11` etc. | S1 |
| ST-04 | Inscription hors bande d’âge (16 ans en U7) | ✓ | ✓ | Warning ou refus documenté | S1 |
| ST-05 | Supprimer / désactiver catégorie avec athlètes | ✓ | ✓ | Pas d’orphelins / 500 | S1 |
| ST-06 | `GET /teams` **sans** `season_id` | ✓ | ✓ | Équipes saison courante (pas liste vide) | S1 |
| ST-07 | `GET /teams?season_id=` explicite | ✓ | ✓ | = ST-06 | S1 |
| ST-08 | Créer équipes FOOT-U11-G1 / G2 | ✓ | ✓ | Visibles UI + API | S1 |
| ST-09 | Assigner 1–2 coachs à une équipe | ✓ | ✓ | Coach voit my-teams | S1 |
| ST-10 | Retirer coach mid-saison | ✓ | ✓ | Séances gérées / message clair | S1 |
| ST-11 | Sync-structure / archive-roster | ✓ | ✓ | Pas de perte athlètes actifs | S1 |
| ST-12 | Deux saisons : inscriptions restent sur bonne saison | ✓ | ✓ | Pas de mélange | S1 |
| ST-13 | Multisport : inscription football puis judo | ✓ | ✓ | Catégories correctes, pas mélange | S1 |
| ST-14 | Monosport : tentative catégorie autre sport | ✓ | ✓ | Refus ou indisponible | S1 |
| ST-15 | Volume : 50+ équipes, filtres | ✓ | ✓ | Pas de freeze / liste vide | S2 |

---

## 5. Pack ATHLÈTES & PARENTS

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| AT-01 | Créer athlète + parent auto (tél DZ) | ✓ | ✓ | Compte parent + lien | S1 |
| AT-02 | Doublon nom+DOB → 409 | ✓ | ✓ | Message clair | S1 |
| AT-03 | Modifier fiche (licence, médical, sang) | ✓ | ✓ | Persisté | S1 |
| AT-04 | Licence / médical &lt; 30 j : pastille + filtre | ✓ | ✓ | Stats cohérents | S2 |
| AT-05 | Archiver athlète → hors listes actives | ✓ | ✓ | Soft-delete | S1 |
| AT-06 | Restaurer depuis historique | ✓ | ✓ | Reparaît | S1 |
| AT-07 | Pagination 100+ athlètes « Charger plus » | ✓ | ✓ | Pas doublons / trous | S2 |
| AT-08 | Recherche accentuée (Méhdi/Mehdi) | ✓ | — | Trouvable | S2 |
| AT-09 | Noms arabes / apostrophes | ✓ | ✓ | Pas 500 | S2 |
| AT-10 | Coach : voit seulement ses équipes | ✓ | ✓ | Scope respecté | S0 |
| AT-11 | Coach : PATCH athlète hors équipe → refus | ✓ | ✓ | 403/404 | S0 |
| AT-12 | Parent : voit uniquement ses enfants | ✓ | ✓ | Scope | S0 |
| AT-13 | Parent 2 enfants : bascule fiche | ✓ | — | Données séparées | S1 |
| AT-14 | Photo upload limite taille | ✓ | ✓ | Erreur propre | S1 |
| AT-15 | Concurrent edit 2 onglets même fiche | ✓ | — | Comportement documenté | S1 |

---

## 6. Pack INSCRIPTIONS

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| IN-01 | Inscription staff nested athlete | ✓ | ✓ | 200 + athlète | S1 |
| IN-02 | Inscription parent → statut pending | ✓ | ✓ | Pending | S1 |
| IN-03 | Approve / reject / archive / restore | ✓ | ✓ | États cohérents | S1 |
| IN-04 | Kit : n°, jersey, sac, deliver | ✓ | ✓ | next-kit-number OK | S1 |
| IN-05 | Double-clic créer inscription | ✓ | ✓ | Pas de doublon cotisation | S0 |
| IN-06 | Double inscription même athlète même saison | ✓ | ✓ | Bloqué ou warning | S1 |
| IN-07 | Catégories visibles après onboard | ✓ | ✓ | Pas « indisponibles » faux | S2 |
| IN-08 | File offline → sync (si exposé) | ✓ | — | Pas doublon | S1 |
| IN-09 | Photo inscription | ✓ | ✓ | Affichage OK | S2 |
| IN-10 | Coach : pas de création inscription (API+UI) | ✓ | ✓ | Aligné matrice | S1 |

**Automate référent :** `test_registration_flow.py`.

---

## 7. Pack AGENDA / PRÉSENCES / NOTIFS PARENTALES

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| AG-01 | Créer entraînement + lieu + notifier parents | ✓ | ✓ | Event + notifs | S1 |
| AG-02 | Match / stage / réunion (types) | ✓ | ✓ | Type persisté | S2 |
| AG-03 | Coach : séance → pending_approval si réglage | ✓ | ✓ | Staff approve | S1 |
| AG-04 | Approve / reject séance | ✓ | ✓ | États | S1 |
| AG-05 | Start → attendance (P/A/L/E) → complete | ✓ | ✓ | Présences sauvés | S1 |
| AG-06 | Absence → notif parent | ✓ | ✓ | Notif reçue | S1 |
| AG-07 | Cancel + notifier | ✓ | ✓ | Parent informé | S1 |
| AG-08 | Convocations + RSVP parent | ✓ | ✓ | État persisté | S1 |
| AG-09 | Prefs parent OFF → pas de spam | ✓ | ✓ | Opt-out respecté | S2 |
| AG-10 | Job rappels parentaux (admin) | ✓ | ✓ | Pas de crash | S2 |
| AG-11 | Parent voit seulement séances de ses enfants | ✓ | ✓ | Scope | S0 |
| AG-12 | Coach hors équipe : pas d’écriture séance | ✓ | ✓ | Refus | S0 |
| AG-13 | 90+ events mois : perf / filtres | ✓ | ✓ | Utilisable | S2 |
| AG-14 | Fuseau Algeria vs UTC minuit | ✓ | ✓ | Bon jour affiché | S2 |

---

## 8. Pack FINANCE (cotisations, paiements, caisse)

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| FI-01 | Settings cotisations / constantes | ✓ | ✓ | Persisté | S1 |
| FI-02 | Génération échéances à l’inscription | ✓ | ✓ | Installments visibles | S1 |
| FI-03 | Paiement quick partiel | ✓ | ✓ | Solde restant correct | S0 |
| FI-04 | **Double encaissement** même échéance | ✓ | ✓ | Refus ou solde cohérent (pas surpaiement silencieux) | S0 |
| FI-05 | Paiement 0 / négatif | ✓ | ✓ | Refusé | S0 |
| FI-06 | Ledger recette / dépense | ✓ | ✓ | Dashboard = somme | S1 |
| FI-07 | Achat matériel → ligne ledger | ✓ | ✓ | Lié | S1 |
| FI-08 | Soft-delete paiement / restore ledger | ✓ | ✓ | Totaux OK | S1 |
| FI-09 | Parent : voit **ses** cotisations seulement | ✓ | ✓ | Scope | S0 |
| FI-10 | Coach : pas d’accès finance write | ✓ | ✓ | 403 / menu absent | S0 |
| FI-11 | Staff vs direction : settings/paie selon matrice | ✓ | ✓ | Droits exacts | S1 |
| FI-12 | Export / reçu (si exposé) | ✓ | — | Pas autre club | S0 |
| FI-13 | Concurrent 2 caisses admin | ✓ | — | Totaux stables | S0 |
| FI-14 | Arrondis DZD / centimes | ✓ | ✓ | Pas de fantômes | S2 |

**Automate référent :** `test_payment_flow.py` (à **étendre** pour FI-04).

---

## 9. Pack MATÉRIEL, ANNONCES, COMPTES, HISTORIQUE

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| INV-01 | CRUD item + alerte stock bas | ✓ | ✓ | Alertes | S1 |
| INV-02 | Assign / purchase | ✓ | ✓ | Stock cohérent | S1 |
| INV-03 | Stock négatif bloqué ou alerté | ✓ | ✓ | Règle claire | S1 |
| AN-01 | Annonces audiences all/parents/coaches/staff | ✓ | ✓ | Visibilité exacte | S1 |
| US-01 | Créer staff/coach/direction ; admin seul crée admin | ✓ | ✓ | Matrice | S0 |
| US-02 | must_change_password forcé | ✓ | ✓ | Gate avant métier | S1 |
| US-03 | Soft-delete user non-admin | ✓ | ✓ | OK | S1 |
| US-04 | Reset MDP | ✓ | ✓ | Login nouveau | S1 |
| HI-01 | Audit create/pay/archive traçable | ✓ | ✓ | Lignes présentes | S2 |
| HI-02 | Restore athlete/registration/ledger | ✓ | ✓ | OK | S1 |
| FB-01 | Feedback UI → visible admin | ✓ | ✓ | Bout-en-bout | S2 |

---

## 10. Pack RÔLES (matrice exhaustive)

Pour **chaque** case de `MATRICE_ROLES_ACCES.md` :

| ID | Scénario | H | A | Attendu |
|----|----------|:-:|:-:|---------|
| RO-xx | Login rôle R → tentative action X autorisée | ✓ | ✓ | 200 / UI OK |
| RO-yy | Login rôle R → tentative action X interdite | ✓ | ✓ | 403 + menu masqué |

**Packs obligatoires :** parent×finance, coach×comptes, coach×create athlete (API vs matrice — **documenter écart**), staff×settings finance, direction×archive.

**Écarts déjà connus à valider :** coach create athlete (matrice É vs API) ; menu Inscriptions mobile coach.

---

## 11. Pack ANDROID / PARITÉ

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| AP-01 | Login HTTPS `api.nadi-connect.com` 4G | ✓ | — | OK | S1 |
| AP-02 | ClubLock suspendu / essai : bandeau + readOnly | ✓ | — | Pas de création | S1 |
| AP-03 | UpdateGate version basse | ✓ | — | Bloque + lien APK | S1 |
| AP-04 | Accueil / Agenda / Plus i18n FR↔AR | ✓ | — | Pas de clés nues | S2 |
| AP-05 | Guide ouvre site + Accueil site | ✓ | — | Retour possible | S2 |
| AP-06 | Onboard mono/multi + 26 sports | ✓ | — | Miroir site | S1 |
| AP-07 | Parent : enfants, agenda, paiements | ✓ | — | Parité web | S1 |
| AP-08 | Marque Nadi Connect (pas WRBH produit) | ✓ | — | Chrome produit | S2 |
| AP-09 | Découvrir le site → webUrl | ✓ | — | HTTPS | S3 |

---

## 12. Pack CHARGE & CONCURRENCE

| ID | Scénario | H | A | Attendu | Sév. |
|----|----------|:-:|:-:|---------|------|
| LD-01 | 5 clubs · 5 admins · 20 coachs · 200 parents · 400 athlètes | ✓ | ✓ | Perf acceptable | S1 |
| LD-02 | 100 parents login aléatoire | — | ✓ | Pas de timeout massif | S1 |
| LD-03 | Double submit inscription / paiement | ✓ | ✓ | Idempotence | S0 |
| LD-04 | Listes 100+ + filtre + charger plus | ✓ | ✓ | Cohérence | S2 |

---

## 13. Affectation automate — backlog prioritaire (non-humain)

À **créer / étendre** dans `backend/tests/` (ordre) :

1. `test_trial_expired_write_lock.py` ← CL-06  
2. `test_teams_default_season.py` ← ST-06 (**régression A05**)  
3. `test_payment_double_charge.py` ← FI-04 (**régression B09**)  
4. `test_agenda_attendance_notify.py` ← AG-05..07  
5. `test_roles_matrix_smoke.py` ← RO (échantillon 20 cases)  
6. `test_onboard_mono_multi.py` ← CL-01/02  
7. Smoke prod : `backend/scripts/smoke_salon_*.py` + health/git_sha  

**CI minimale :** `pytest backend/tests -q` sur chaque PR + smoke post-deploy VPS.

**Non-humain UI :** Playwright/Cypress **optionnel** sur login → équipes non vides → inscription (après fix A06).

---

## 14. Campagnes d’exécution (calendrier testeur)

| Vague | Durée | Scénarios | Critère GO |
|-------|-------|-----------|------------|
| **V1 Isolation** | 1 j | MT-* + A01–A04, A09, A13 | 0 FAIL S0 |
| **V2 Argent & cycle** | 1 j | CL-06/07, FI-*, INV-02 | Write lock + totaux OK |
| **V3 Structure & volume** | 1–2 j | ST-*, AT-07, AG-13, LD-01 | Équipes visibles ; pagination OK |
| **V4 Rôles** | 1–2 j | RO + B02–B06 | Matrice respectée API+UI |
| **V5 Android** | 0,5–1 j | AP-* | Parité critique OK |
| **V6 Cosmétique / i18n** | 0,5 j | CL-11/12, C07 | Marque + RTL OK |

**Définition « fiabilité revendiquée ~100 % métier » (honnête) :**

- Toutes les vagues V1–V5 **vertes** (0 S0, 0 S1 ouverts).  
- Les S2/S3 restants listés et acceptés.  
- Automates des **régressions critiques** (ST-06, FI-04, MT-*) en CI.  
- Rejeu V1 après chaque déploiement prod.

---

## 15. Journal de vérité (à tenir à jour)

| Date | Campagne | FAIL ouverts | Note |
|------|----------|--------------|------|
| 2026-10-02 | Audit navigateur | A05/B07, A06, B09 (+ SKIP A10/A11) | Voir `RAPPORT_EXECUTION_SCENARIOS_AUDIT_2026-10-02.md` |
| 2026-10-03 | Catalogue H+A publié | — | Ce document |
| 2026-10-03 15h10 | Exécution H+A | **ST-06**, **FI-03/04**, **API domaine timeout** ; pytest 23/23 ; IP:8081 OK | `RAPPORT_CATALOGUE_FIABILITE_2026-10-03.md` |
| 2026-10-03 16h10 | Correctifs Lot A2/A3 + B1/B2 | ST-06/FI-04/A06/B18 **code+tests** ; deploy en cours ; rejeu H requis | `ORDRE_REPARATION_FIABILITE_100.md` |
| 2026-10-03 16h15 | Deploy A4 | Prod `git_sha=6f1efcb1a150` ; rejouer ST-06 / FI-04 / W0 listes+chrome | — |
| 2026-10-03 16h45 | Lot B3–B6 + C1/C2 | Suspend+trial+IDOR+rôles inventory ; UI A06 harden ; pytest 31 | Deploy + rejeu W0 |

---

*Fin du catalogue. Toute nouvelle feature site/app doit ajouter des lignes ici **et** dans `SCENARIOS_AUDIT_EXPERT_FAILLES.md` si la faille est probable.*
