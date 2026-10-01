# ORDRE DÉVELOPPEUR APPLICATION ANDROID — Synchronisation avec le site

**Produit :** **Nadi Connect** (نادي = club en arabe → « le club connecté »)  
**Public :** développeur application Android (Expo)  
**Règle :** le **site web** est la source de vérité. L’app doit **miroiter** les mêmes capacités métier (ou afficher clairement « bientôt »).  
**API prod :** `http://46.224.38.201:8081` (préfixe `/api/v1`)  
**Web prod :** `http://46.224.38.201:8080`  
**Documents liés :** `ORDRE_LOGICIEL_MAITRE.md` · `MATRICE_ROLES_ACCES.md` · `ORDRE_DEV_SUIVI_PARENTAL.md` · `DEMO_SCRIPTEE_NADI_CONNECT.md`

**Date ordre :** 2026-10-01 (maj)  
**Version API cible :** ≥ **1.17.0**

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

### Lot C — à ajouter dans l'app (suite audit 2026-10-01)

**C1 backend est déployé (2026-10-01).** Retester l’écran Inscription ; le reste du tableau reste à faire côté app.

**État vérifié dans le code le 2026-10-01 à 13h30** (pas déclaratif — lecture de `mobile/src/api/client.ts` et `mobile/app.json`).

| # | À faire dans l'app | État | Détail technique |
|---|--------------------|------|------------------|
| C1 | Retester Inscription | ✅ **fait** | `formatApiError` (`client.ts:25-45`) gère 500 avec un message lisible. Backend corrigé et déployé : `POST /registrations` renvoie 200 en prod. |
| C4 | Message 409 onboarding | ✅ **fait** | Le `detail` est remonté par `formatApiError`. |
| C5 | Rate-limit 429 | ✅ **fait** | `client.ts:26-28` : « Trop de tentatives — réessayez dans quelques minutes (réseau partagé). » Pas de réessai en boucle. |
| **C11** | **Internationalisation FR / AR + RTL** | ❌ **le plus gros manque** | **Aucun système i18n dans l'app.** `useI18n`, `i18n`, `locale ===` : **0 occurrence** dans `mobile/`. `I18nManager` et tout traitement RTL : **absents**. L'arabe n'existe qu'en **44 lignes de chaînes codées en dur** réparties dans 10 fichiers (ex. `"Connexion / دخول"`). Le web a un dictionnaire FR/AR complet (`web/src/i18n.tsx`, ~70 clés) **avec bascule de langue et RTL**. Vous vendez un produit bilingue ; l'app est en pratique francophone. Pour des parents arabophones, c'est bloquant. **À faire :** porter `web/src/i18n.tsx` en contexte React Native, bascule de langue dans Profil, `I18nManager.forceRTL` pour l'arabe, puis migrer les écrans dans cet ordre : Accueil → Agenda → Inscriptions → Athlètes → Paiements. |
| **C12** | **Gérer le code 403** | ❌ **à faire** | `client.ts` traite `401` (déconnexion) et `429`, mais **`403` n'est géré nulle part** dans `mobile/src`. Or le backend renvoie désormais `403` dans trois cas : club suspendu en écriture (A7), utilisateur non rattaché à un club, rôle insuffisant. Sans traitement, l'utilisateur voit une erreur brute. |
| C9 | Écran « club suspendu » | ❌ **à faire** | Dépend de C12. Bandeau « abonnement suspendu — lecture seule » et masquage des boutons de création quand un `403` « Club suspendu » revient. Le backend autorise la lecture et l'export. |
| C2 | Basculer en HTTPS | ⏳ **bloqué par B1** | `app.json:74` → `"apiUrl": "http://46.224.38.201:8081"` et `app.json:27` → `"usesCleartextTraffic": true` **toujours actifs**. Dès que le domaine est en place : `https://api.<domaine>`, retirer `usesCleartextTraffic`, rebuild, republier, mettre à jour `ANDROID_APK_URL`. **Prérequis Play Store.** |
| C8 | Démo salon hors ligne | ❌ **à faire, prioritaire** | `src/config.ts` lit `extra.apiUrl` depuis `app.json` : vérifier si c'est surchargeable à l'exécution. Sinon, produire un **APK de démo** pointant vers l'IP du portable. Le wifi SAFEX n'est pas fiable — c'est le filet de sécurité du stand. |
| C10 | Revalider les notifications | ❌ **à vérifier** | `notify_role` est corrigé côté backend et les `Notification` portent désormais un `club_id`. Vérifier que l'onglet notifications ne montre que le club courant. |
| C3 | Revalider l'écran parent | ❌ **à vérifier** | Après cloisonnement : `GET /children` et `GET /mobile/home` ne doivent renvoyer que les enfants du club. |
| C7 | Licence + certificat médical | ⏳ **bloqué par C2 site** | Attendre le déploiement du schéma backend (`license_valid_until`, `medical_cert_valid_until`), puis miroir sur la fiche athlète + pastille d'expiration. |
| C6 | Parité manquante | 📋 **après salon** | Écran Guide / formation absent (le web a `/guide`, désormais **route publique** — une `WebView` suffirait). Administration des feedbacks absente. |

**Ordre de priorité app avant le 12 octobre :**

1. **C8** — démo hors ligne (sans ça, pas de filet au salon)
2. **C12 + C9** — gérer `403` et l'état suspendu
3. **C2** — HTTPS, dès que le domaine est prêt (dépend de B1)
4. **C10 + C3** — revalidation du cloisonnement
5. **C11** — i18n : commencer par Accueil et Agenda, les deux écrans montrés en démo

**C11 en entier ne rentre pas avant le salon.** Visez les deux écrans de démonstration en arabe, et planifiez le reste après le 15 octobre.

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
