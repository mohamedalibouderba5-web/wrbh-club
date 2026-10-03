# ORDRE DÉVELOPPEUR APPLICATION ANDROID — Synchronisation avec le site

**Produit :** **Nadi Connect** (نادي = club en arabe → « le club connecté »)  
**Public :** développeur application Android (Expo)  
**Règle :** le **site web** est la source de vérité. L’app doit **miroiter** les mêmes capacités métier (ou afficher clairement « bientôt »).  
**API prod :** `http://46.224.38.201:8081` (préfixe `/api/v1`)  
**Web prod :** `http://46.224.38.201:8080`  
**Documents liés :** `ORDRE_LOGICIEL_MAITRE.md` · `MATRICE_ROLES_ACCES.md` · `ORDRE_DEV_SUIVI_PARENTAL.md` · `DEMO_SCRIPTEE_NADI_CONNECT.md`

**Date ordre :** 2026-10-01 (maj)  
**Version API cible :** ≥ **1.18.0**

> **ORDRE ACTIF (2026-10-01, 16h20) — à exécuter dans cet ordre :**  
> **`docs/ORDRE_APP_ANDROID.md`**  
> Lot **A** (produit en marche) → puis Lot **B** (HTTPS) → puis Lot **C** (salon / arabe).  
> Ne pas inverser. Check-lists et APIs dedans.

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
| 2026-10-03 16h10 | (sync site) | **A2/A3 déployés (code)** : `GET /teams` saison club ; `payments/quick` impute échéance due + clamp (409 si soldée). **À retester app** : Équipes non vides ; Agenda select équipes ; Paiements impute même `installment_id` ; pas de rebuild APK requis (contrat API). Chrome web = nom club (miroir sous-titre app déjà OK) |

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
