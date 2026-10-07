# ORDRE DÉVELOPPEUR APPLICATION ANDROID — Synchronisation avec le site

**Produit :** **Nadi Connect** (نادي = club en arabe → « le club connecté »)  
**Public :** développeur application Android (Expo)  
**Règle :** le **site web** est la source de vérité. L’app doit **miroiter** les mêmes capacités métier (ou afficher clairement « bientôt »).  
**API prod :** `http://46.224.38.201:8081` (préfixe `/api/v1`)  
**Web prod :** `http://46.224.38.201:8080`  
**Documents liés :** `ORDRE_LOGICIEL_MAITRE.md` · `MATRICE_ROLES_ACCES.md` · `ORDRE_DEV_SUIVI_PARENTAL.md` · `DEMO_SCRIPTEE_NADI_CONNECT.md`

**Date ordre :** 2026-10-01 (maj)  
**Version API cible :** ≥ **1.18.0**

> **ORDRE ACTIF (2026-10-07 ~12h00) — priorité développeur app :**  
> **§9nonies — Sync prod site `git_sha=d71f677`** → build / publier APK **1.18.3** (vc25).  
> Miroir obligatoire des livraisons web W1–W5 + Impayés + Plus Matériel/Historique/Annonces.  
> Recette téléphone + Nox. P2 seulement après score ≥ 90 %.

> **ORDRE ACTIF historique :** §9octies · §9septies · §9sexies · Lot A→B→C.

---

## 0. Accord d’équipe — travail parallèle

**Oui**, vous pouvez avancer **en même temps** que le chantier site :

| Canal | Rôle |
|-------|------|
| Discussion site / produit | Nouvelles features web + API |
| Discussion application | Miroir app selon **ce document** |

**Conditions anti-conflit :**
1. Ne pas inventer d’API ou de parcours côté app avant qu’ils soient listés ici.  
2. Après **chaque** livraison site → une section « À ajouter » + ligne journal (§9) + §15 du maître.  
3. Documenter les **ajouts** (écrans, boutons, payloads), pas seulement les bugs corrigés.  
4. Un **historique** des correctifs reste append-only (§9 + maître §15).

Chaque livraison site → mettre à jour aussi le **§ Journal** de `ORDRE_LOGICIEL_MAITRE.md` + ce fichier.

---

## 1. Priorité immédiate (à faire maintenant dans l’app)

| # | Tâche app | Équivalent site | API / détail |
|---|-----------|-----------------|--------------|
| **A1** | **Login multi-club** : champ / sélecteur **code club (slug)** | `/login` | `GET /club/list` · login form `club_slug` + username/password · stocker `wrbh_club_slug` |
| **A2** | Afficher branding du club choisi (nom, sport) | branding login | `GET /club/branding?slug=` |
| **A3** | Lien ou écran **Créer un club** (essai 14 j) — optionnel v1 | `/onboard` | `POST /club/onboard` + `GET /club/sports` |
| **A4** | **Multisport** : lister / ajouter sports du club | Équipes → « Sports du club » | `GET/POST /disciplines` · catégories préfixées `FOOT-U11`, `JUDO-U11`… |
| **A5** | Catégories / équipes **filtrables par discipline** | listes catégories | `GET /categories?discipline_id=` |
| **A6** | Menus selon **rôle** (pas de Finance pour parent, etc.) | `AppLayout` | Voir `MATRICE_ROLES_ACCES.md` |
| **A7** | Accueil **parent** dédié (enfants, séances, notifs, prefs) | `ParentHomePage` | `GET /mobile/home` · `/notifications` · `/parent/notification-prefs` |
| **A8** | Agenda : cycle séance (start / complete / attendance / approve) | Agenda web | Voir `ORDRE_DEV_SUIVI_PARENTAL.md` |

### Lot B — Marque Nadi Connect + offre (depuis 2026-09-30 / 10-01)

| # | **À AJOUTER** dans l’app | Site | Schéma / détail |
|---|--------------------------|------|-----------------|
| **B1** | Nom affiché produit = **Nadi Connect** (splash, login titre, profil version) | Login / Install / Download | Ne plus présenter « WRBH Club » comme nom du **logiciel**. WRBH = un **club** (slug `wrbh`) parmi d’autres. |
| **B2** | Logo produit Nadi Connect (`assets/logo.png` aligné web) | `/logo.png` | Icône / splash déjà fournis côté repo mobile |
| **B3** | Sur login : titre produit **Nadi Connect** + sous-titre = **nom du club** choisi | `/login` | `brand.name` / `name_ar` = club ; produit ≠ club |
| **B4** | Lien ou bouton **Offres / Tarifs** (WebView ou navigateur) | `/pricing` | URL : `http://46.224.38.201:8080/pricing` — packs Discovery / Club / Academy |
| **B5** | (Optionnel) Lien **Créer un club** déjà A3 — rappeler essai 14 j Discovery | `/onboard` | Même contrat §3 |
| **B6** | Textes permissions / store : « Nadi Connect a besoin de… » | — | Remplacer libellés WRBH dans `app.json` plugins |

**Hors app (site only, pas de miroir obligatoire) :** landing marketing `/` (invité), script démo commerciale.

### Lot C — Alignement N° joueur + dashboard (2026-10-01)

| # | **À AJOUTER** dans l’app | Site | Schéma / détail |
|---|--------------------------|------|-----------------|
| **C1** | Liste athlètes : afficher **`list_number`** (N° joueur) = même rang que Inscriptions | `/athletes` | `GET /athletes` → `list_number`, `kit_number`, `registration_reference` — **ne pas** afficher `id` (268…) comme n° joueur |
| **C2** | Accueil / stats : données du **club courant** (saison courante scopée) | Dashboard | Si graphes vides : forcer refresh ; API bootstrap/analytics filtrés par `club_id` |
| **C3** | (Optionnel) Lien **Guide / Formation** | `/guide` | Contenu = formation complète Nadi Connect (FR/AR) |
| **C4** | (Optionnel) Lien **Devenir pilote** | `/pilote` | Programme essai 14 j → Club / Academy |

---

## 2. Déjà sur le site (à vérifier dans l’app actuelle)

| Module site | Obligation app |
|-------------|----------------|
| Inscriptions + pagination « Charger plus » | Même pagination / pas de plafond silencieux à 40 |
| Finance staff (échéances multi-statut, delete paiement) | Si onglet paiements coach/staff : mêmes droits |
| Historique / corbeille (admin/direction/staff) | Restaurer si exposé |
| Prefs notifications parent | Profil parent |
| Rôles admin / direction / staff / coach / parent | Ne pas afficher les boutons interdits |
| Marque Nadi Connect + `/pricing` | Lot **B1–B6** |

---

## 3. Multi-club — contrat technique

### Connexion
```
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=...&password=...&club_slug=wrbh
```
- Sans `club_slug` : compat mono-club (comportement ancien).  
- Avec `club_slug` : l’utilisateur doit appartenir à ce club.  
- Persister le slug en local storage / SecureStore.

### Liste clubs (écran login)
```
GET /api/v1/club/list
→ [{ slug, name, name_ar, sport, primary_color, ... }]
```

### Onboarding (nouveau club)
```
POST /api/v1/club/onboard
{
  "club_name": "...",
  "slug": "mon-club",
  "sport": "football",
  "sports": ["judo", "swimming"],
  "admin_full_name": "...",
  "admin_email": "...",
  "admin_password": "..."
}
```
Essai `plan=discovery`, `trial_ends_on` = J+14.

### Branding club (pas le produit)
```
GET /api/v1/club/branding?slug=wrbh
→ { name, name_ar, acronym, sport, primary_color, accent_color, logo_path, app_name? }
```
- **Produit système** = toujours **Nadi Connect**.  
- **Club** = `name` / `name_ar` / `acronym` (ex. WRBH).

---

## 4. Multisport — contrat technique

Un **même club** peut avoir plusieurs **disciplines** (football + judo + natation…).

| Action | API |
|--------|-----|
| Lister sports du club | `GET /api/v1/disciplines` |
| Ajouter un sport (+ catégories âge) | `POST /api/v1/disciplines` `{ "sport": "karate", "seed_categories": true }` |
| Catalogue sports DZ | `GET /api/v1/club/sports` |
| Catégories d’une discipline | `GET /api/v1/categories?discipline_id=` |

**UI app attendue (admin / direction) :** écran ou section « Sports du club » (comme sur web Équipes).

---

## 5. Comptes de test (prod)

| Club | Slug | Login | Mot de passe |
|------|------|-------|--------------|
| WRBH (football) | `wrbh` | `admin@wrbh.local` | `ExpoDash2026!` |
| Démo judo (multisport) | `demo-judo-978` | `admin@demo-judo-978.test` | `DemoClub!2026` |

Sur le démo judo : disciplines **Judo + Football + Natation** déjà présentes.

---

## 6. Ordre de travail développeur Android (sprint)

1. Branche / build depuis l’app actuelle Expo.  
2. **Lot B** (Nadi Connect + lien pricing) si pas encore en store interne.  
3. Vérifier **A1–A8** encore verts après rebuild.  
4. Rebuild APK → déposer sur `/download` + bump `android_app_version`.  
5. Cocher dans le journal §15 de `ORDRE_LOGICIEL_MAITRE.md` + §9 ici.

---

## 7. Critères d’acceptation (DoD app)

- [x] Connexion avec slug `wrbh` **et** `demo-judo-978` OK  
- [x] Parent ne voit pas Finance / Comptes / Corbeille  
- [x] Admin club démo voit ≥ 2 sports dans « Sports du club »  
- [x] Création / démarrage / fin séance + prefs parent (si rôle concerné)  
- [x] APK installable depuis le site Download  
- [x] Aucun bouton qui appelle une API interdite (403 surprise)  
- [x] Splash / login / version = **Nadi Connect** (lot B)  
- [x] Lien offres `/pricing` accessible depuis login ou profil  

---

## 8. Hors scope de cet ordre (plus tard)

- Billing paiement en ligne (Stripe / CIB)  
- Landing marketing complète (site only — voir `/` invité)  
- Sous-domaines `club.domaine.dz`  
- Push FCM production (si pas encore)

---

## 9. Journal app Android

| Date | Version | Notes |
|------|---------|-------|
| 2026-09-26 | 1.6.0 | Suivi parental |
| 2026-09-30 | **1.7.0** | A1–A6 (+A3) : multi-club login/branding, sports, rôles, onboard |
| 2026-10-01 | **1.8.0** | Lot B+C : liens Offres/Guide/Pilote, N° joueur `list_number`, msgs 429/500/409 ; sync fix parents `club_id` |
| 2026-10-01 | (sync site) | **Lot A backend déployé** : inscriptions OK en prod ; parents `club_id` ; notifs scopées ; club suspendu lecture seule ; `/guide` `/download` publics. **À faire app** : C1 retest, C3, C9, C10 (voir tableau) |
| 2026-10-01 | (sync site) | **A10/B3/B4** : `/health.git_sha` ; login par code club (liste vitrine `is_platform` seulement). **App** : champ slug obligatoire, ne plus dépendre d’un annuaire clients ; afficher `429` compte vs réseau si `detail` change |
| 2026-10-01 | (sync site) | **Marque Nadi Connect définitive** : login/splash/icône = logo Nadi Connect uniquement (plus de substitution par logo club). Nom club = sous-titre. Ne jamais réintroduire « WRBH Club » comme nom produit |
| 2026-10-01 | (sync site) | **Lot C** : champs licence/certificat médical API ; messages **403** (suspendu / essai) dans `client.ts`. **À faire app** : formulaire licence+médical + bandeau lecture seule (C9) |
| 2026-10-01 | (sync site) | **C2 site complet** : API `license_expiring_soon` / `medical_expiring_soon` + stats club `license_expiring_count` / `medical_expiring_count` ; filtre renouvellement web. **C3 web Finance** FR/AR. **À ajouter app (C7)** : champs dates licence/médical sur fiche athlète ; pastille <30 j ; filtre « à renouveler » ; optionnel compteurs Accueil depuis `/club/stats` |
| 2026-10-01 | **1.9.0** | **C7** : champs `license_valid_until` / `medical_cert_*` + pastille expiration. Config API android → 1.9.0/vc12. **Reste** : rebuild+publier APK, C8 démo offline, C9 bandeau, C11 i18n Accueil/Agenda |
| 2026-10-01 | **1.9.0** | **C9** : `ClubLockProvider` bandeau suspendu/essai + masquage création Athlètes/Inscriptions. **À faire** : rebuild APK + C8 + C11 |
| 2026-10-01 16h20 | — | **Ordre exécutable** `docs/ORDRE_APP_ANDROID.md` : APP-A1…A6 (publier 1.9.0, inscription, parent, notifs, suspendu, onboard 409) puis B HTTPS puis C. **APK public encore 1.8.0** |
| 2026-10-01 | **1.9.0 publié** | **APP-A1** : APK sur `/download` + UpdateGate ; Lot A code (403, ClubLock, licences) en production |
| 2026-10-01 16h50 | scan app | **Reste 100 %** : recette A3/A4/A5 ; `readOnly` 5 écrans ; C11 i18n ; C8 APK démo ; filtre licences ; HTTPS bloqué site. Taux A+B+C ~56 % |
| 2026-10-01 16h55 | salon | **C8 APK offline ANNULÉ.** Priorité salon online : recettes M1–M3, ClubLock M4, i18n Accueil/Agenda M5, filtre licences M6 |
| 2026-10-01 17h40 | **1.10.0** | Vérif : APK 1.10.0 publié ; M4/M5/M6 **faits** dans le binaire. Reste recettes M1–M3 téléphone |
| 2026-10-01 17h20 | **1.10.0** | **M4** ClubLock write Agenda/Paiements/Équipes/Comptes/Matériel ; **M5** `I18nContext` Accueil+Agenda + bascule Profil FR/AR ; **M6** filtre « À renouveler » ; sync site S1–S4. Publier APK 1.10.0/vc13. **Reste téléphone :** M1–M3 recettes ; **M7** HTTPS bloqué domaine |
| 2026-10-01 19h15 | **1.11.0** | i18n Login + Plus + Athlètes ; écran Guide (ouvre `/guide`) ; sync W-4 suspendre. Recettes A-2…A-4 téléphone toujours ouvertes |
| 2026-10-01 20h20 | **1.12.0** | **Recettes A-2 A-3 A-4 OK via API prod** (`_prove_a234.py`) ; i18n Inscriptions/Messages/Paiements ; `must_change_password` forçable false ; APK réel 67 Mo (plus de leurre HTML) |

| 2026-10-01 20h15 | **1.12.0** | **A-2/A-3/A-4 API OK** : inscription staff+parent, children scoped `club_id`, notifs club-scoped. Nginx coupe SPA sur `.apk` manquant. **Rien à ajouter** pour salon VPS ; optionnel rejouer recettes sur téléphone physique |
| 2026-10-02 | **après DNS** | **B1 HTTPS** : pointer `extra.apiUrl` → `https://api.nadi-connect.com`, `webUrl` → `https://nadi-connect.com` (déjà dans `app.json` local). Rebuild APK quand DNS A Cloudflare est vert ; retirer `usesCleartextTraffic` après validation 4G |
| 2026-10-02 | (sync site) | Site vitrine marketing sur `https://nadi-connect.com` — **rien à coder dans l’app** ; optionnel : bouton « Découvrir le site » Profil → `webUrl` |
| 2026-10-02 | (sync site) | **Onboard mono/multisport + 26 sports** : code déjà poussé dans `mobile/app/onboard.tsx` (chips Type + liste élargie). **À faire développeur app** : rebuild APK après sync ; vérifier `GET /api/v1/club/sports` (≥26) ; monosport = 1 sport ; multisport = principal + ≥1 extra ; ne plus hardcoder football/judo/karaté seuls |
| 2026-10-02 17h20 | **1.13.0** | **APP-B1+B2 FAIT** : HTTPS `api.nadi-connect.com` / `nadi-connect.com` ; cleartext OFF ; eas/config fallbacks domaine ; Profil « Découvrir le site » ; onboard mono/multi + 26 sports déjà dans binaire ; UpdateGate 1.13.0/vc16 |
| 2026-10-02 | (sync site) | **Marque AR** : jamais traduire le nom produit. Toujours **Nadi Connect** ; sous-titre AR = « تسيير ومتابعة النوادي الرياضية ». Corriger login / Accueil / Guide / Plus si encore « نادي كونكت ». Rebuild APK après sync |
| 2026-10-02 19h30 | (sync site) | **Équipes prod** : `GET /teams` vide si saison courante globale ≠ club — fix backend `Season.club_id`. **App** : appeler list teams avec saison du club courant (ou même fix côté API) ; retester Équipes/Agenda après deploy ; bouton Feedback = `POST /feedback/report` (miroir web) |
| 2026-10-02 23h50 | (sync site) | **Scénarios audit expert** `SCENARIOS_AUDIT_EXPERT_FAILLES.md` : Campagne 5 Android (ClubLock essai/suspendu, bandeau, UpdateGate, i18n, parent multi-club). **À faire** : checklist téléphone A10/A11/B19/B20 + IDOR children |
| 2026-10-03 00h10 | (sync site) | **Exécution audit live** : isolation OK ; teams vides sans `season_id` club ; `payments/quick` peut créer échéances au lieu de payer la due. **App** : lister teams avec saison club ; paiements doivent lier `installment_id` existant ; forcer `must_change_password` (API 403 déjà OK coach) |
| 2026-10-03 | (sync QA) | **Catalogue fiabilité** `docs/CATALOGUE_SCENARIOS_FIABILITE_100.md` : packs Android AP-* (HTTPS, ClubLock, onboard, i18n, marque). Vague V5 téléphone ; pas de suite jest/detox → recettes H |
| 2026-10-03 15h10 | (sync QA) | **Exécution catalogue** : `api.nadi-connect.com` **timeout** alors que API IP:8081 OK — **AP-01 HTTPS bloqué** tant que DNS/proxy non réparé. ST-06 teams + FI-04 paiements toujours FAIL côté API |
| 2026-10-03 15h40 | (sync QA) | **Ordre réparation** `ORDRE_REPARATION_FIABILITE_100.md` Lot D : après fix API (domaine + teams + payments) → checklist M0 téléphone (HTTPS, équipes, agenda, paiements, ClubLock, i18n, Feedback). **Ne pas** rebuild APK vers IP HTTP |
| 2026-10-03 16h10 | (sync site) | **A2/A3 déployés (code)** : `GET /teams` saison club ; `payments/quick` impute échéance due + clamp (409 si soldée). **À retester app** : Équipes non vides ; Agenda select équipes ; Paiements impute même `installment_id` ; pas de rebuild APK obligatoire (contrat API). Chrome web = nom club (miroir sous-titre app déjà OK) |
| 2026-10-03 16h45 | **1.14.0** | **Lot D code** : paiements `installment_id` + bouton encaisser échéance + anti double-tap ; ClubLock Messages ; fallback équipes/agenda si coaches vide ; pastilles licence **et** certificat ; login slug obligatoire ; parent filtre échéances. vc17 HTTPS |
| 2026-10-03 16h45 | (sync site) | **B3/B4/C1** : club suspendu login lecture seule ; `/mobile/children` strict club ; inventory API staff-only. **À retester app** : parent multi-club (pas d’enfant autre club) ; ClubLock suspendu après login ; Feedback/listes après cold start |
| 2026-10-03 18h45 | (sync site) | **A1 CLOS** : `https://api.nadi-connect.com` = DNS only → VPS, health **200** client. **À AJOUTER / retester en M0 :** login slug `horizon-blida-882` / `demo-foot-safex` sur **API HTTPS** (plus de Failed to fetch CF) ; Équipes + Agenda + Paiements quick ; ClubLock. APK actuel 1.14.0 OK si `EXPO_PUBLIC_API_URL` = `https://api.nadi-connect.com` — **pas de rebuild obligatoire** pour A1 |
| 2026-10-03 22h50 | (sync audit) | **Lot A IDOR + B partiel** déployer API : roster/présences/convocations/photos/`POST /payments` cross-club → 404. **À retester app après deploy :** Agenda roster + présences ; photo joueur ; encaissement `/payments` et `/payments/quick`. Pas de rebuild IP HTTP |
| 2026-10-03 22h25 | (sync audit) | Audit expert ≈ **64 %** : IDOR agenda roster/présences, médias, `POST /payments` (pas `/quick`). **App :** après fix API, retester Agenda + photos + encaissement classique. Pas de rebuild IP HTTP |
| 2026-10-03 22h35 | (sync site) | **Ordre** `ORDRE_CORRECTIFS_AUDIT_EXPERT.md` Lot D4 : après deploy Lots A+B API — retester M0 Agenda (roster/présences), photos joueur, `/payments` + `/payments/quick`. Pas de rebuild IP HTTP. Barème (C3) = feature plus tard, pas bloquant app |
| 2026-10-04 12h35 | (sync site) | **Club test Sisi** `sisi-blida-13865` / `admin@sisi-blida-13865.test` / `SisiEssai2026!` — ~309 joueurs. **App :** login slug + checklist M0 (équipes, agenda, paiements) sur ce tenant. Voir `CLUB_SISI_ACCES_FR_AR.md` |
| 2026-10-04 14h00 | (sync site) | **Ordre dév club** `CS_Sisi_Blida_conseils_amelioration_FR_AR.md` : P0 app = M0 + listes >200 + menus Plus Finance/Comptes/Équipes sur Sisi |
| 2026-10-03 22h35 | (sync audit) | **Ordre correctifs** `ORDRE_CORRECTIFS_AUDIT_INGENIERIE_FR_AR.md` Lot A Android : après deploy Lots S+F → recettes M0 présences, RSVP, photos, paiements. Rebuild seulement si payload client change |
| 2026-10-04 12h35 | (sync QA) | **Club Sisi** `sisi-blida-13315` / `admin@sisi-blida-13315.test` / `SisiEssai2026!` — ~300 joueurs pour stress listes. **À tester app :** login slug, Athlètes pagination, Finance, Équipes, Agenda |
| 2026-10-03 23h30 | (sync Codex) | **Lots 1+2+4 API/web déployés.** **À AJOUTER app :** (1) token JWT uniquement via `expo-secure-store` (déjà branché `client.ts` / `AuthContext` — rebuild APK obligatoire pour effet device) ; (2) médias : ne jamais mettre le JWT dans l’URL image — utiliser `/media/{id}/signed-url` ou chemin déjà signé `exp`+`sig` ; (3) recettes M0 après deploy : Agenda roster/présences, photo joueur, `/payments` + `/payments/quick`, stock attribution. Pas de rebuild vers IP HTTP |
| 2026-10-04 01h20 | (sync reste) | **P1 web/API clos** (P1-6…9, R0-10/14). **Priorité app = P2/M0** téléphone/Nox : M0-01…16 + SecureStore rebuild. Pas de rebuild IP HTTP |
| 2026-10-04 01h50 | **1.14.0** Nox | **M0 partiel OK** sur Nox : session, équipes (U11+sports), agenda, paiements, feedback, DNS HTTPS. **À AJOUTER / corriger :** chrome Accueil affiche « Administrateur WRBH » sans **Nadi Connect** produit ; finir M0-06/07/08/09/14 comptes jetables ; rebuild SecureStore |
| 2026-10-04 14h15 | **1.15.0** | **Fix Athlètes Sisi** : plus de `limit=300` (erreur « ≤ 200 ») ; pages de 100 + « Charger plus » + retry limit=50 ; Paiements/Matériel athletes ≤200 ; bandeau **Discovery J-n**. Installer 1.15.0 sur Nox/téléphone |
| 2026-10-04 14h15 | (sync clients) | **Chaîne A0** après avis CS Sisi : **À AJOUTER / rebuild APK** — (1) Accueil titre **Nadi Connect** + sous-titre club ; (2) athlètes pagination « Charger plus » + API `limit` jusqu’à 500 ; (3) shortcuts Accueil Finance + Comptes ; (4) Plus libellé Finance. Recette slug `sisi-blida-13865` (~300 joueurs) |
| 2026-10-04 14h00 | (sync site) | **Console plateforme V1** livrée site+API. **À AJOUTER dans l’app (fait code local) :** écran `/(tabs)/platform` ; entrée Plus `roles: ["superadmin"]` ; APIs `GET /admin/dashboard`, `GET/PATCH /admin/clubs`, `GET/PATCH /admin/users`. **Recette :** login `platform@nadi-connect.local` (sans slug club) → Plus → Plateforme → KPI + suspendre. Rebuild APK pour device. |
| 2026-10-04 15h40 | (sync site UX) | **Densité affichage site** (pas d’API). **À AJOUTER app :** (1) Agenda — filtre mois courant + détail séance / roster **à côté** de la liste (pas scroll en bas) ; (2) Inscriptions/Athlètes — formulaires compacts, liste prioritaire ; (3) Finance — KPI cotisations + bouton constantes non full-width ; (4) Équipes — CTA créer équipe/coach compacts. Aucun changement payload. |
| 2026-10-04 15h55 | (sync site UX fix2) | **À AJOUTER app :** photo à côté des champs sans chevauchement ; Inscriptions filtres cat./groupe près des exports ; Équipes = Sports + Coachs en 2 colonnes puis table. Pas de changement API. |
| 2026-10-05 02h00 | (sync Hydra313 P1) | **À AJOUTER app :** (1) Finance — onglet Achats = `entry_type=expense` seulement ; paiement équipement = recette `equipment_sale` ; (2) Matériel — recherche athlètes `GET /athletes?q=` ; (3) Échéances — `GET /installments/meta` + pagination skip/limit ; (4) Dashboard membres = inscriptions (pas âge croisé sports). |
| 2026-10-05 12h20 | (sync rôles UI) | **À AJOUTER app :** Accueil coach (équipes liées + séances) ; menus filtrés comme `roles/access.ts` ; parent sans Finance/Comptes ; coach sans Finance/Comptes/Historique ; annonces publish = staff/direction/admin seulement. Doc `INTERFACES_PAR_ROLE_FR_AR.md`. |
| 2026-10-05 20h40 | (audit Nox app vs web) | Rapport `RAPPORT_AUDIT_APPROFONDI_APP_ANDROID_VS_WEB_2026-10-05_FR_AR.md` : APK **1.15.0** vs API **1.18.0** — **pas à jour produit**. Preuves `mobile/dist/deep_audit/`. **À AJOUTER :** voir **§9quater** (rebuild, rôles, Hydra, moreHint). |
| 2026-10-05 23h40 | (ordre dév app) | **§9quater** ajouté — lot obligatoire post-audit Nox (priorité P0/P1). Le développeur app doit exécuter §9quater avant toute autre feature salon. |
| 2026-10-06 12h00 | (sync notifs hub) | **§9quinquies** — Centre notifications + son (site Chrome) livré. **À AJOUTER app :** push FCM/Expo, cloche + badge, dashboards par rôle, miroir kinds (session_*, payment_*, finance_*, registration, inventory, coach_payroll, parent_message). |
| 2026-10-06 12h10 | (repère projet) | Fichier `REPERE_PROJET_NADI_CONNECT_FR_AR.md` + tableau `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md`. Lire §9quinquies pour notifs/dashboards app. |
| 2026-10-05 23h50 | **1.16.0** | **§9quater P0+P1** : Accueil coach/parent/staff dédiés ; Plus filtrés + moreHint par rôle ; Achats=`expense` ; équipement=recette hint ; `athletes?q=` Matériel/Finance ; installments `/meta` + Charger plus. vc19 HTTPS |
| 2026-10-04 16h20 | (sync audit ali sportage) | Club essai `elite-multisports-ali` / `admin@elite-multisports-ali.test` / `AliSportage2026!`. **À AJOUTER app :** (1) message clair si API refuse âge hors plage club ; (2) **ne pas** afficher/promettre scan QR-RFID accès tant que non livré API+app ; (3) recette parent 2 enfants = 2 fiches + paiements séparés (pas de paiement familial unique). Voir `RAPPORT_AUDIT_ALI_SPORTAGE_FIABILITE_2026-10-04_FR_AR.md` |
| 2026-10-06 01h15 | **1.16.1** | **Fix Paiements** : ordre formulaire Mois → Montant → Joueur ; liste joueurs `ScrollView` maxHeight 168 + overflow hidden ; après sélection = chip + « Changer » (plus de liste flottante sur les mois). vc20 HTTPS |
| 2026-10-06 12h15 | **1.17.0** | **§9quinquies** : `NotificationBell` header + badge ; mark read / read-all ; deep links ; push listener + canal Android ; dashboards Accueil Admin/Staff/Coach/Parent. vc21 HTTPS |
| 2026-10-06 14h00 | (sync fiabilité globale) | Campagne Nox 1.17.0 + site : login/Accueil/Agenda/Paiements OK ; nav Athlètes/Matériel Automator faible. **À AJOUTER :** G2-01 chemins Plus stables ; G0-05 libellés FR/AR ; deep links `/users` (pas `/accounts`) ; G2-02 Maestro/Detox login+4 onglets. Ordre `ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md` |
| 2026-10-06 15h00 | (sync rejeu QA) | Nox parcours tabs OK ; Plus→Inscriptions/Équipes/Comptes OK ; **Athlètes/Matériel/Historique taps fragiles**. Site Équipes vide (G0-03) alors qu’app liste OK — **ne pas inventer** parcours divergents ; attendre fix site. Score global **72 %** |
| 2026-10-06 17h25 | (sync vérif ordre) | Contrôle prod : G0/G1 annoncés livrés **non visibles** sur API/web (`ui-density`) ; Nox encore **1.17.0**. G2-01 **ouvert**. Voir `VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md` |
| 2026-10-06 17h00 | (site G0/G1/NC) | Site a livré lot fiabilité 06/10 (G0-01…06, NC-01/02/03/09, G1-02/03/05/06/07). **À AJOUTER app :** **§9sexies** (notes GET, catégorie inscription, âge club, import CSV, Plus G2-01, i18n Accueil). |
| 2026-10-06 17h15 | **1.18.0** | **§9sexies** : Plus `Link`+testID (G2-01) ; notes athlète GET+no wipe (NC-01) ; Cat. inscription (NC-03) ; libellés Suspendu/Payé/… (G0-06) ; âge finance/settings (G1-05) ; Import CSV (G1-06) ; deep links `/accounts`→Comptes ; Maestro `login_tabs.yaml`. vc22 HTTPS |
| 2026-10-06 17h55 | (reste à régler) | Retest : G2-01 encore partiel Automator. **Fix code :** Plus utilise `router.push` (plus Link seul). **À FAIRE :** rebuild APK **1.18.1** + Nox 6/6. Source `RESTE_A_REGLER_FIABILITE_100.md`. |
| 2026-10-06 18h00 | **1.18.1** | **§9sexies clos** : G2-01 `router.push`+rAF Plus ; NC-06 profil AR/RTL ; NC-07/10 déjà ; Maestro login_tabs. vc23 HTTPS |
| 2026-10-06 22h20 | **1.18.2** | **Fix Impayés Accueil** : appelait `/finance/dashboard` (404) → 0 ; + utilisait `overdue_count` seul. Désormais `/dashboard` + `unpaid_count` / meta `due,partial,overdue` (WRBH = 32 / 135k DZD). API `unpaid_count` sur `/dashboard`. vc24 |
| 2026-10-07 00h20 | (ordre actif) | **§9septies** publié : rebuild + publier APK **1.18.2** ; recette Impayés Accueil = Paiements (tous clubs). |
| 2026-10-07 00h30 | **1.18.2** | **§9septies** : Accueil Impayés via `/dashboard` + `unpaid_count` / meta due+partial+overdue. vc24 HTTPS publié |
| 2026-10-07 03h00 | (ordre actif) | **§9octies** : après rejeu Nox 11/14 — **À AJOUTER** Plus → Matériel / Historique / Annonces stables ; APK ≥1.18.3 si correctif. Source `ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md`. |
| 2026-10-07 03h05 | (sync ordre) | Rejeu 1.18.2 : Athlètes/Inscriptions/Comptes OK ; Matériel/Historique Plus encore NON. **À AJOUTER** A1–A3 + APK ≥1.18.3 ; sync W1/W3 site avant écrans vides. |
| 2026-10-07 03h35 | **1.18.3** code | A1–A3 : Plus Matériel/Historique/Annonces (titres QA, testID, push) ; sync site W1–W5. **À FAIRE ops :** build APK vc25 + deploy VPS. |
| 2026-10-07 12h00 | (sync prod) | Site/API **live** `git_sha=d71f677` (W1–W5 + Impayés). **ORDRE §9nonies** : build APK **1.18.3** pour miroir app. |

---

## 9nonies. À AJOUTER — Sync Android = prod site `d71f677` (2026-10-07) — **ORDRE ACTIF OBLIGATOIRE**

**Site = vérité** déployé : `https://api.nadi-connect.com/health` → `git_sha=d71f677`.  
L’app **doit** offrir les **mêmes** capacités (pas de parcours inventé).

### Fonctionnalités à synchroniser (déjà dans le code app `main` — à **publier**)

| # | Feature site live | **À AJOUTER / PUBLIER** dans l’app | API / fichier |
|---|-------------------|-------------------------------------|---------------|
| **S1** | Impayés Accueil = échéances ouvertes | Accueil staff : `unpaid_count` via `GET /api/v1/dashboard` (+ meta) | `index.tsx` |
| **S2** | Historique journal | Plus → **Historique** land `GET /api/v1/audit` | `history.tsx` · `more.tsx` |
| **S3** | Annonces fil | Plus → **Annonces** land fil `GET /api/v1/announcements` | `messages.tsx` (onglet annonces) |
| **S4** | Matériel inventaire | Plus → **Matériel** land inventaire | `inventory.tsx` |
| **S5** | Âge club (settings) | Afficher plage âge si message erreur / finance | `GET /finance/settings` |
| **S6** | Import CSV (optionnel v1.18.3) | Si écran import : JSON `POST /athletes/import` ou fichier `POST /athletes/import/file` | Athlètes |

### Build & publication (obligatoire)

| # | Action | Preuve |
|---|--------|--------|
| **B1** | Pull `main` (≥ `d71f677`) | — |
| **B2** | APK **1.18.3** · `versionCode` **25** | `app.json` |
| **B3** | Publier `wrbh-club-1.18.3.apk` sur prod + UpdateGate | URL `/wrbh-club-1.18.3.apk` |
| **B4** | Recette téléphone + Nox | Plus → Matériel / Historique / Annonces ; Accueil Impayés ≠ 0 si Paiements a un reste (WRBH + Sisi) |

### Checklist

- [ ] APK 1.18.3 installé  
- [ ] S1 Impayés Accueil OK  
- [ ] S2–S4 Plus 3 écrans OK  
- [ ] Journal §9 ligne « 1.18.3 publié »  

**P2** (G2-03 familial / G2-04 QR / G2-05 Feedback) : **après** score global ≥ 90 %.

---

## 9octies. À AJOUTER — Nav Plus Matériel / Historique / Annonces (2026-10-07) — **intégré §9nonies**

**Contexte QA Nox 07/10 :** login + onglets OK ; Plus→Athlètes/Inscriptions/Équipes/Comptes/Finance **OK** ; **FAIL** Plus→**Matériel**, **Historique**, **Annonces** (tap/land). Score app ≈ **79 %** ; cible globale ≥ **90 %**.

### Ce qu’il faut AJOUTER / CORRIGER (app)

| # | **À AJOUTER** | Détail | API / écran |
|---|---------------|--------|-------------|
| **NAV-01** | Entrée **Matériel** dans Plus (scroll si besoin) | `router.push` fiable → inventaire ; testID Automator | `GET /api/v1/inventory/items` |
| **NAV-02** | Entrée **Historique** dans Plus | Land journal / corbeille | `GET /api/v1/audit` |
| **NAV-03** | Entrée **Annonces** dans Plus | Land fil (même données site) | `GET /api/v1/announcements` |
| **NAV-04** | Labels FR + AR visibles | Texte exact pour taps QA : `Matériel`, `Historique`, `Annonces` | `more.tsx` / i18n |
| **NAV-05** | Rebuild APK **≥ 1.18.3** si code change | UpdateGate + install Nox/téléphone | `app.json` versionCode++ |
| **NAV-06** | Recette | Plus → 3 écrans land + données (Sisi ou WRBH) | Preuve dump / capture |

### Checklist développeur app

- [x] Matériel visible + land depuis Plus *(code 1.18.3)*  
- [x] Historique visible + land depuis Plus *(code)*  
- [x] Annonces visible + land depuis Plus *(entrée dédiée)*  
- [ ] APK **1.18.3** publié + install Nox/téléphone  
- [ ] Ligne journal §9 après install  


### Dépendance site

Attendre / synchroniser W1 (Historique web) et W3 (fil Annonces) du doc `ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md` pour ne pas afficher des écrans vides alors que l’API a des données.

---

## 9septies. À AJOUTER — Fix Impayés Accueil (2026-10-07) — **publier / recette téléphone**

**Bug (tous clubs, pas seulement WRBH) :** Accueil staff/admin affiche **0 Impayés** alors que l’onglet **Paiements** montre un reste réel.  
**Preuve WRBH :** 32 échéances / 135 000 DZD ouvertes ; `overdue_count` = 0 ; ancienne URL `/api/v1/finance/dashboard` = 404.

### Ce qu’il faut FAIRE (app)

| # | **À AJOUTER / CORRIGER** | Détail |
|---|--------------------------|--------|
| **IMP-01** | Accueil Impayés = échéances **ouvertes** | Compter `due` + `partial` + `overdue` — **pas** seulement `overdue` |
| **IMP-02** | Appeler le bon endpoint finance | `GET /api/v1/dashboard` (jamais `/api/v1/finance/dashboard`) |
| **IMP-03** | Utiliser `unpaid_count` API | Champ `unpaid_count` sur `/dashboard` ; fallback `GET /api/v1/installments/meta?status=due,partial,overdue` → `total` |
| **IMP-04** | Rebuild APK **1.18.2** (vc24) | Publier `wrbh-club-1.18.2.apk` + UpdateGate |
| **IMP-05** | Recette téléphone (pas seulement Nox) | Club **WRBH** + un 2ᵉ club (ex. Sisi) : Accueil Impayés **=** nb / logique de l’onglet Paiements « À payer » |

### Code déjà prêt (ne pas réinventer)

- Fichier : `mobile/app/(tabs)/index.tsx` (commit `8352b5d`)  
- API : `backend/app/api/finance.py` → `unpaid_count`  
- Versions : `mobile/app.json` **1.18.2** / `versionCode` **24**

### Checklist développeur app

- [x] Confirmer Accueil utilise `/api/v1/dashboard` + `unpaid_count` / meta  
- [x] Build APK **1.18.2** vc24  
- [x] Déposer APK sur prod (`/wrbh-club-1.18.2.apk`) + env `ANDROID_*`  
- [ ] Recette WRBH téléphone : Accueil Impayés ≠ 0 si Paiements a un reste  
- [ ] Recette 2ᵉ club (Sisi) : même règle  
- [x] Ligne journal §9 (publication APK)  

### Hors scope app (site / ops)

- Déployer API `8352b5d` sur Hetzner si pas encore live (`git_sha` health).  
- Web carte Impayés déjà corrigée dans le même commit.

---

## 9sexies. À AJOUTER — Fiabilité globale 2026-10-06 (après lot site G0/G1/NC) — **OBLIGATOIRE**

**Sources site :** `docs/ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md`, `output/reports/audit_global_2026_10_06/NadiConnect_Ameliorations_2026-10-06.md`, `docs/REPERE_COMMERCIALISATION_FIABILITE_2026-10-06_FR_AR.md`.  
**Site = vérité** — ne pas inventer d’API ; miroir des contrats ci-dessous.

### P0 — Alignement API / navigation

| # | **À AJOUTER** | API / détail |
|---|----------------|--------------|
| **G2-01** | Navigation **Plus** fiable → Athlètes, Matériel, Historique, Comptes | **`router.push(route)`** sur chaque ligne Plus (pas seulement Link) ; Automator/Nox **6/6** ; rebuild **1.18.1** |
| **NC-01** | Notes athlète à la relecture | `GET /api/v1/athletes` renvoie `notes` — initialiser édition avec `athlete.notes` ; ne jamais PATCH notes vides si champ non touché |
| **NC-03** | Catégorie = inscription saison | Afficher `category_code` de l’inscription courante (multisport) |
| **G0-06** | Filtres Accueil FR/AR | `Active`→Actif, `Suspended`→Suspendu, `training`→Entraînement, `paid`/`due`→Payé/Dû |

### P1 — Config club + import

| # | **À AJOUTER** | API / détail |
|---|----------------|--------------|
| **G1-05** | Âge configurable | `GET/PUT /api/v1/finance/settings` → `min_athlete_age`, `max_athlete_age` ; message erreur avec plage ; Elite → max 99 |
| **G1-06** | Import CSV | `POST /api/v1/athletes/import` body `{ "csv": "..." }` → `{ created, skipped, errors }` |
| **G1-02** | Liste paiements | `GET /api/v1/payments` = alias `/payments/recent` (plus de 405) |
| **G0-04** | Deep link Comptes | Web `/accounts`→`/users` — deep links app → écran Comptes |

### P2 — Qualité (audit NC)

| # | **À AJOUTER** | Détail |
|---|----------------|--------|
| **NC-06** | i18n AR profil | Titres/labels + RTL |
| **NC-07** | Validation inscription vide | Erreurs champs + focus 1er invalide |
| **NC-10** | Libellés métier Achats/Matériel | Pas de `entry_type=expense` brut |
| **G2-02** | Maestro/Detox minimale | Login + 4 onglets |

### Checklist

- [x] G2-01 Plus → 6 écrans *(router.push + rAF ; APK **1.18.1**)*
- [x] NC-01 notes formulaire *(GET détail + notesTouched)*
- [x] NC-03 category_code inscription *(affichage Cat. code)*
- [x] G0-06 libellés Accueil *(Suspended→Suspendu, income/expense…)*
- [x] G1-05 plage âge + message
- [x] G1-06 écran import CSV
- [x] NC-06 i18n AR profil
- [x] NC-07 validation inscription
- [x] NC-10 libellés Achats
- [x] G2-02 Maestro `mobile/maestro/login_tabs.yaml`
- [x] Rebuild APK **1.18.1** + ligne journal §9

---

## 9quater. À AJOUTER — Alignement post-audit Nox (2026-10-05) — **OBLIGATOIRE**

**Contexte :** audit approfondi Nox sur club `sisi-blida-13315`.  
**Rapport :** `docs/RAPPORT_AUDIT_APPROFONDI_APP_ANDROID_VS_WEB_2026-10-05_FR_AR.md`  
**Preuves :** `mobile/dist/deep_audit/`  
**Constat :** APK installée **1.15.0** / API prod **1.18.0** → données OK, **produit app en retard** sur le web (rôles UI + Hydra P1 + densité).

### P0 — Rebuild & socle

| # | **À AJOUTER / FAIRE** | Détail |
|---|----------------------|--------|
| **N0-1** | Rebuild APK **≥ 1.16.0** (versionCode ≥ 19) | `EXPO_PUBLIC_API_URL=https://api.nadi-connect.com` ; déposer sur `/download` ; bump `android_app_version` côté API/site |
| **N0-2** | Recette Nox Admin + Coach + Parent | Slug `sisi-blida-13315` — Accueil, Agenda, Finance (admin), Matériel (admin), Inscriptions, Messages, Profil |

### P0 — Interfaces par rôle (miroir web `web/src/roles/access.ts`)

| # | **À AJOUTER** | API / écran | Critère d’acceptation |
|---|---------------|-------------|------------------------|
| **N0-3** | Accueil **Coach** dédié | `/(tabs)/index` si `role===coach` | Équipes liées + séances à venir + raccourcis Agenda/Présences ; **pas** KPI finance club |
| **N0-4** | Accueil **Parent** (renforcer) | déjà partiel | Enfants, convocations, notifs, prefs — texte limites (pas créer séance / pas finance club) |
| **N0-5** | Menus **Plus** filtrés stricts | `more.tsx` `ITEMS.roles` | Parent : pas Finance/Comptes/Athlètes/Matériel/Historique. Coach : pas Finance/Comptes/Historique/Matériel |
| **N0-6** | Corriger **`moreHint`** par rôle | `I18nContext` | Ne plus afficher « finance, matériel et historique » pour coach/parent |
| **N0-7** | Annonces **publish** | `messages.tsx` | Bouton « Publier » = staff / direction / admin seulement (lecture OK pour coach/parent) |

Réf. web : `docs/INTERFACES_PAR_ROLE_FR_AR.md` · `docs/MATRICE_ROLES_ACCES.md` §16.

### P1 — Hydra 313 (alignement finance / matériel / échéances)

| # | **À AJOUTER** | API | Critère |
|---|---------------|-----|---------|
| **N1-1** | Paiement **équipement** = recette | Ledger / quick pay | Catégorie ou flux `equipment_sale` (pas dépense Achats) — miroir web H313-01 |
| **N1-2** | Onglet / liste **Achats** | `GET /ledger?entry_type=expense` | Uniquement expenses |
| **N1-3** | Recherche athlètes Matériel (et Finance) | `GET /athletes?q=` | Plus de liste plate limit=200 seule |
| **N1-4** | Échéances meta + pages | `GET /installments/meta` + `skip`/`limit` | « Charger plus » si total > page |

Réf. : journal § 2026-10-05 02h00 (Hydra313 P1).

### P2 — Densité UX (après P0/P1)

| # | **À AJOUTER** | Notes |
|---|---------------|-------|
| **N2-1** | Agenda : détail / roster accessible sans scroll excessif | Sync UX web 2026-10-04 |
| **N2-2** | Formulaires Inscriptions / Athlètes plus compacts | Liste prioritaire |

### Hors scope (ne pas inventer)

- QR / RFID accès terrain  
- Paiement en ligne  
- Features non listées dans le maître / ce document  

### Checklist livraison développeur app

- [x] APK rebuildée installée sur Nox *(publiée `/download` 1.16.0 — recette Nox à confirmer)*
- [x] N0-3 → N0-7 code *(Accueil rôles, Plus, moreHint, publish staff+)*
- [x] N1-1 → N1-4 code *(Achats expense, équipement hint, `q=`, meta+pages)*
- [ ] Captures ou checklist M0 jointe
- [x] Ligne journal §9 + bump version

---

## 9quinquies. À AJOUTER — Notifications + tableaux de bord (2026-10-06) — **OBLIGATOIRE**

**Site livré :** cloche Chrome + son (`NotificationBell`), polling `/notifications`, kinds métier via `broadcast.py`.  
**Réf. :** `docs/ORDRE_LOGICIEL_MAITRE.md` journal 2026-10-06 · API `GET /notifications`, `unread-count`, `POST .../read`, `read-all`, `POST /push-tokens`.

### Matrice destinataires (miroir site — ne pas inventer)

| Destinataire | Kinds / événements |
|--------------|-------------------|
| **Admin / Direction (gérant)** | Tout : séances create/cancel/start/end, inscriptions, encaissements, dépenses, achats matériel, messages parents, rappels salaires coach |
| **Staff / compta** | Finance (`finance_income`, `finance_expense`), inscriptions, matériel |
| **Coach** | Séances (création admin, annulation), messages parents, rappel paiement coach (`coach_payroll`) |
| **Parent** | Séances (create/start/end/cancel/attendance/reminder), paiements (`payment_parent`, `payment_balance` = reste mensuel selon tarif) |

### P0 — App notifications

| # | **À AJOUTER** | Détail |
|---|---------------|--------|
| **N3-1** | Cloche + badge non lus | `GET /api/v1/notifications/unread-count` + liste `GET /notifications` |
| **N3-2** | Marquer lu | `POST /notifications/{id}/read` · `POST /notifications/read-all` |
| **N3-3** | Push téléphone | Enregistrer jeton `POST /push-tokens` (Expo Notifications / FCM) ; son + vibration à réception |
| **N3-4** | Préférences parent | Déjà `parent/notification-prefs` — exposer dans Profil |
| **N3-5** | Deep link `link` | Ouvrir Agenda / Finance / Accueil selon `notification.link` |

### P0 — Tableaux de bord app (par rôle)

| # | **À AJOUTER** | Contenu minimum |
|---|---------------|-----------------|
| **N3-6** | Dashboard **Admin/Direction** | KPI club : séances du jour, impayés, dernières notifs, raccourcis Finance / Agenda / Inscriptions |
| **N3-7** | Dashboard **Staff / compta** | Focus finance : encaissements du jour, dépenses, échéances dues |
| **N3-8** | Dashboard **Coach** | Équipes + séances + notifs messages parents (aligné N0-3) |
| **N3-9** | Dashboard **Parent** | Enfants + solde cotisations + prochaines séances (aligné N0-4) |

### Checklist

- [x] N3-1…N3-5 code *(cloche, read, push register+listener, prefs parent déjà Profil, deep link)*  
- [x] N3-6…N3-9 écrans Accueil distincts *(KPI finance admin/staff ; coach/parent renforcés)*  
- [x] Rebuild APK + journal §9 *(1.17.0 / vc21)*  

---

## 9ter. À AJOUTER — Console plateforme superadmin (2026-10-04)

### APIs

| Endpoint | Usage |
|----------|--------|
| `GET /api/v1/admin/dashboard` | KPI globaux + `online_users` + `recent_clubs` |
| `GET /api/v1/admin/clubs` | Liste clubs + compteurs |
| `PATCH /api/v1/admin/clubs/{id}` | `{ status, plan, trial_ends_on, is_platform }` |
| `GET /api/v1/admin/users?role=&online_only=&q=` | Comptes cross-club + présence |
| `PATCH /api/v1/admin/users/{id}` | `{ is_active }` |

Présence = `User.last_seen_at` (login + activité API, fenêtre **15 min**).

### Écran app

1. Menu **Plus** → **Plateforme** visible seulement si `role === "superadmin"`.
2. Route `/(tabs)/platform` : KPI + connectés + liste clubs (suspendre/réactiver).
3. Login plateforme : email `platform@…` **sans** code club (ou slug ignoré).

### Recette

Login superadmin → Plus → Plateforme → voir KPI → pull-to-refresh → suspendre un club démo → réactiver.

## 9bis. À AJOUTER — Onboard sports (2026-10-02)

### API (déjà en prod après deploy)

| Endpoint | Usage |
|----------|--------|
| `GET /api/v1/club/sports` | Liste `{code,label,label_ar}` — **26 sports** Algérie |
| `POST /api/v1/club/onboard` | Body : `sport` (principal) + `sports: string[]` (additionnels, vide si monosport) |

### Écran `onboard` (miroir site `/onboard`)

1. **Étape type** : bascule **Monosport** | **Multisport** (obligatoire, avant la liste).
2. **Monosport** : une seule sélection de sport ; envoyer `sports: []`.
3. **Multisport** : sport principal + chips/checkboxes des autres ; exiger ≥1 additionnel ; envoyer `sports: [...]` sans le principal.
4. **Fallback offline** : utiliser la liste complète (pas seulement 3 sports) si l’API échoue.
5. Labels AR : utiliser `label_ar` de l’API quand `locale=ar`.

### Recette téléphone

- [ ] Liste ≥ 20 sports visibles
- [ ] Monosport → club créé avec 1 discipline
- [ ] Multisport football+judo+natation → 3 disciplines / catégories seedées


### Lot C — à ajouter dans l'app (suite audit 2026-10-01)

**C1 backend est déployé (2026-10-01).** Retester l’écran Inscription ; le reste du tableau reste à faire côté app.

**État vérifié dans le code le 2026-10-01 à 13h30** (pas déclaratif — lecture de `mobile/src/api/client.ts` et `mobile/app.json`).

| # | À faire dans l'app | État | Détail technique |
|---|--------------------|------|------------------|
| C1 | Retester Inscription | ✅ **fait** | `formatApiError` (`client.ts:25-45`) gère 500 avec un message lisible. Backend corrigé et déployé : `POST /registrations` renvoie 200 en prod. |
| C4 | Message 409 onboarding | ✅ **fait** | Le `detail` est remonté par `formatApiError`. |
| C5 | Rate-limit 429 | ✅ **fait** | `client.ts:26-28` : « Trop de tentatives — réessayez dans quelques minutes (réseau partagé). » Pas de réessai en boucle. |
| **C11** | **Internationalisation FR / AR + RTL** | ✅ **étendu 1.11.0** | Accueil+Agenda+Login+Plus+Athlètes + Guide. |
| **C12** | **Gérer le code 403** | ✅ **dans l’APK 1.9.0** | `client.ts:29-42`. |
| C9 | Écran « club suspendu » | ✅ **1.10.0** | Bandeau + `readOnly` Athlètes/Inscriptions/Agenda/Paiements/Équipes/Comptes/Matériel. |
| C2 | Basculer en HTTPS | ⏳ **hors scope** | Pas de domaine. |
| C8 | Démo salon hors ligne | ❌ **ANNULÉ** (16h55) | Client : wifi / 4G au stand ; APK prod seulement. |
| C10 | Revalider les notifications | ❌ **à vérifier** | Recette téléphone M3. |
| C3 | Revalider l'écran parent | ❌ **à vérifier** | Recette téléphone M2. |
| C7 | Licence + certificat médical | ✅ **1.10.0** | Dates + pastille + filtre « À renouveler ». |
| C6 | Parité Guide | ✅ **1.11.0** | Écran Plus → Guide → ouvre `/guide` site. |

**Ordre de priorité app — voir `docs/ORDRE_APP_ANDROID.md` :** Lot A (APK 1.9.0 + tests produit) → Lot B HTTPS → Lot C (recette licences, APK démo, arabe Accueil/Agenda).

---

## 10. Schéma mental (anti-conflit)

```
[Site Nadi Connect]  --documents-->  [ORDRE_DEV_APP_ANDROID]
        |                                      |
        v                                      v
   API / web prod                    App Expo (miroir)
```

- Conflit évité si l’app **attend** la doc avant d’inventer.  
- Pas besoin d’attendre la fin totale du site pour coder l’app : coder **le lot documenté**.

---

*Fin de l’ordre Android. Toute nouvelle feature site doit ajouter une ligne ici + dans ORDRE_LOGICIEL_MAITRE §15.*
