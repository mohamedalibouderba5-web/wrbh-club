# ORDRE DÉVELOPPEUR APPLICATION ANDROID — Synchronisation avec le site

**Public :** développeur application Android (Expo)  
**Règle :** le **site web** est la source de vérité. L’app doit **miroiter** les mêmes capacités métier (ou afficher clairement « bientôt »).  
**API prod :** `http://46.224.38.201:8081` (préfixe `/api/v1`)  
**Web prod :** `http://46.224.38.201:8080`  
**Documents liés :** `ORDRE_LOGICIEL_MAITRE.md` · `MATRICE_ROLES_ACCES.md` · `ORDRE_DEV_SUIVI_PARENTAL.md`

**Date ordre :** 2026-09-30  
**Version API cible :** ≥ **1.17.0**

---

## 0. Accord d’équipe

Oui : **avant d’avancer davantage côté produit**, l’app Android doit être **mise à jour** pour rester synchronisée (multi-club, multisport, login, menus par rôle).  
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

---

## 2. Déjà sur le site (à vérifier dans l’app actuelle)

| Module site | Obligation app |
|-------------|----------------|
| Inscriptions + pagination « Charger plus » | Même pagination / pas de plafond silencieux à 40 |
| Finance staff (échéances multi-statut, delete paiement) | Si onglet paiements coach/staff : mêmes droits |
| Historique / corbeille (admin/direction/staff) | Restaurer si exposé |
| Prefs notifications parent | Profil parent |
| Rôles admin / direction / staff / coach / parent | Ne pas afficher les boutons interdits |

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
  "sports": ["judo", "swimming"],   // multisport dès la création
  "admin_full_name": "...",
  "admin_email": "...",
  "admin_password": "..."
}
```
Essai `plan=discovery`, `trial_ends_on` = J+14.

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
2. **A1 + A2** (login slug) — bloquant commercial.  
3. **A6** (menus rôles) — sécurité UX.  
4. **A4 + A5** (multisport).  
5. **A7 + A8** (parent + agenda) si pas déjà en 1.6.x.  
6. **A3** onboarding (peut être v1.1).  
7. Rebuild APK → déposer sur `/download` + bump `android_app_version`.  
8. Cocher dans le journal §15 de `ORDRE_LOGICIEL_MAITRE.md`.

---

## 7. Critères d’acceptation (DoD app)

- [x] Connexion avec slug `wrbh` **et** `demo-judo-978` OK  
- [x] Parent ne voit pas Finance / Comptes / Corbeille  
- [x] Admin club démo voit ≥ 2 sports dans « Sports du club »  
- [x] Création / démarrage / fin séance + prefs parent (si rôle concerné)  
- [x] APK installable depuis le site Download  
- [x] Aucun bouton qui appelle une API interdite (403 surprise)

---

## 8. Hors scope de cet ordre (plus tard)

- Billing / pricing packs  
- Landing marketing  
- Sous-domaines `club.domaine.dz`  
- Push FCM production (si pas encore)

---

## 9. Journal app Android

| Date | Version | Notes |
|------|---------|-------|
| 2026-09-26 | 1.6.0 | Suivi parental |
| 2026-09-30 | **1.7.0** | A1–A6 (+A3) : multi-club login/branding, sports, rôles, onboard |

---

*Fin de l’ordre Android. Toute nouvelle feature site doit ajouter une ligne ici + dans ORDRE_LOGICIEL_MAITRE §15.*
