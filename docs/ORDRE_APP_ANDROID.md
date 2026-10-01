# Ordre de travail — Développeur application Android

**Destinataire :** discussion / développeur **application Android uniquement**  
**Émis le :** 2026-10-01, 16h20  
**Source de vérité :** le site (API Hetzner). L’app **ne invente pas** de parcours. Lire cet ordre, pas le code web au hasard.  
**API prod :** `http://46.224.38.201:8081` · **Web :** `http://46.224.38.201:8080`  
**Marque :** **Nadi Connect** uniquement (logo `mobile/assets/logo.png`). Le nom du club = sous-titre, jamais le titre produit.

**Règle d’ordre :** **Lot A d’abord.** Lot B puis Lot C **seulement** quand le Lot A est coché. Ne pas commencer l’arabe, la démo hors ligne ou le HTTPS tant que A n’est pas livré **sur le téléphone**.

---

## État du dépôt vs ce que les utilisateurs ont

| Élément | Dans git | Sur le téléphone (prod) |
|---------|----------|-------------------------|
| `app.json` version | **1.9.0 / versionCode 12** | APK public = **1.8.0** (`web/public/wrbh-club-1.8.0.apk`) |
| Messages 403 / essai | `client.ts` | Pas dans l’APK 1.8.0 |
| Bandeau club suspendu | `ClubLockProvider` | Pas dans l’APK 1.8.0 |
| Licence / certificat | `athletes.tsx` | Pas dans l’APK 1.8.0 |
| Page download site | pointe encore **1.8.0** (`DownloadPage.tsx`) | Les parents téléchargent l’ancienne app |

**Conséquence :** une partie du code Lot A est **déjà écrite**. Votre première livraison n’est pas d’inventer : **builder, publier, tester**.

Backend déjà en prod (vous n’attendez plus le site pour A1/A2/A4/A7/A8) : inscriptions 200, parents `club_id`, onboard 409, club suspendu 403 en écriture, notifs scopées.

---

# LOT A — Remettre le produit en marche (à faire **maintenant**)

Quatre tâches. Sans ça, l’app n’est pas au niveau du site.

### APP-A1 — Publier l’APK 1.9.0

1. Rebuild release Expo/EAS (`version` 1.9.0, `versionCode` 12 — déjà dans `mobile/app.json`).
2. Copier le fichier vers `web/public/wrbh-club-1.9.0.apk`.
3. Faire pointer le téléchargement dessus :
   - `web/src/pages/DownloadPage.tsx` (aujourd’hui `wrbh-club-1.8.0.apk`)
   - `ANDROID_APK_URL` / `VITE_ANDROID_APK_URL` (le backend `config.py` annonce déjà `…/wrbh-club-1.9.0.apk` — **fichier absent** → lien cassé)
4. Déployer le site pour que `/download` serve le 1.9.0.
5. Installer **depuis `/download`** sur un téléphone, pas depuis un USB de dev.

**Critère :** un parent ouvre `/download`, installe, `À propos` / UpdateGate affiche **1.9.0**.

### APP-A2 — Inscription (même bug qu’au site, maintenant corrigé côté API)

L’écran Inscriptions appelle `POST /api/v1/registrations`.

1. Compte **staff/admin** d’un club de test (pas WRBH réel).
2. Créer une inscription avec **téléphone parent** DZ valide (10 chiffres, ex. `055xxxxxxx`).
3. Doit afficher succès (HTTP **200**), **pas** 500.

**Critère :** 1 inscription réelle OK sur l’APK 1.9.0. Si 500 : coller le `detail` — ne pas « corriger » l’app en inventant un autre endpoint.

### APP-A3 — Parent : enfants du **son** club seulement (cloisonnement A2)

Les comptes parents sont maintenant rattachés à un `club_id`.

1. Deux clubs (ou club démo + un autre).
2. Compte **rôle parent** du club A, enfant au club A.
3. `GET /api/v1/children` et `GET /api/v1/mobile/home` (écran Accueil parent).
4. **Aucun** enfant du club B. Pas de noms / téléphones d’un autre club.

**Critère :** capture ou note « parent A = N enfants du club A, 0 du club B ».

### APP-A4 — Notifications du club seulement (cloisonnement A8)

1. Même parent / staff, onglet notifications (Accueil / messages selon l’écran actuel).
2. Déclencher une notif de rôle ou de séance **depuis le club A** (site).
3. Le club B **ne** doit **pas** la voir.

**Critère :** une notif club A n’apparaît pas sur un compte club B.

### APP-A5 — Club suspendu / essai fini (A7) — **vérifier** le code déjà dans git

Déjà dans le dépôt :

- `mobile/src/api/client.ts` : 403 « suspendu » / « essai »
- `mobile/src/context/ClubLockContext.tsx` + `_layout.tsx` : bandeau + lecture seule

**À faire :** sur l’APK **1.9.0** (pas le simulateur seul) :

1. Demander au backend de passer un club de test en `status=suspended` (ou essai Discovery expiré).
2. Relancer l’app **sans** se déconnecter (jeton déjà émis).
3. **Lecture** OK (listes).
4. **Création** athlète / inscription **refusée** (403) + bandeau visible, boutons création masqués.

**Critère :** pas d’erreur brute type « Erreur API » ; bandeau lisible ; export/lecture possibles.

### APP-A6 — Onboard 409 (déjà dans le client)

`POST /club/onboard` avec un téléphone admin **déjà utilisé** → **409**.  
L’écran `onboard.tsx` doit afficher le `detail` (ex. « Téléphone admin déjà utilisé »), pas un 500.

**Critère :** 1 essai 409, message lisible, on peut corriger le champ.

---

**Check-list de sortie Lot A app**

- [x] APK 1.9.0 installable depuis `/download`
- [ ] Inscription + téléphone parent → OK
- [ ] Parent : uniquement les enfants de son club
- [ ] Notifications : uniquement son club
- [ ] Club suspendu : bandeau + pas de création
- [ ] Onboard 409 lisible

**Interdit tant que cette liste n’est pas verte :** i18n complète, HTTPS, APK démo salon, Play Store, Guide WebView.

---

# LOT B — Après le Lot A (stand / HTTPS)

**Ne pas commencer avant que B1 site (domaine + certificat) soit en ligne.** Vous serez bloqué.

### APP-B1 — HTTPS

Quand le site donne `https://api.<domaine>` :

1. `mobile/app.json` → `extra.apiUrl` et `extra.webUrl` en `https://…`
2. `mobile/eas.json` : `EXPO_PUBLIC_API_URL` idem
3. **Retirer** `android.usesCleartextTraffic`
4. Rebuild, **versionCode +1** (13), republier, UpdateGate

**Critère :** l’app parle en HTTPS ; plus de HTTP IP.

### APP-B2 — Lien download

Aligner `DownloadPage` + `ANDROID_APK_URL` sur le nouvel APK HTTPS.

---

# LOT C — Après le Lot A (ce que le salon / le produit bilingue exige)

Le **code C7 licences est déjà dans git** (1.9.0). À recetter sur l’APK publié, puis le reste.

### APP-C1 — Recette licences / certificat (déjà codé)

Écran Athlètes : champs `license_valid_until`, `medical_cert_date`, `medical_cert_valid_until`, pastille « < 30 j ».  
Libellés encore **français en dur** — acceptable pour C1 ; l’arabe = APP-C3.

**Critère :** saisir une date, pastille si ≤ 30 jours, liste lisible.

### APP-C2 — APK de démonstration hors ligne (salon)

`config.ts` lit `EXPO_PUBLIC_API_URL` **au build**, pas à l’exécution.

1. Un build **séparé** : `EXPO_PUBLIC_API_URL=http://<IP-du-portable>:8081`
2. Portable en point d’accès + `docker-compose` local
3. **Ne pas** remplacer l’APK prod 1.9.0 par celui-là

**Critère :** démo complète **sans** wifi SAFEX ni 4G.

### APP-C3 — Arabe Accueil + Agenda seulement (pas toute l’app)

Aujourd’hui : **0** `useI18n` / `I18nManager` dans `mobile/app` et `mobile/src`.  
Porter le dictionnaire `web/src/i18n.tsx` (clés existantes), bascule dans Profil, `I18nManager.forceRTL` si arabe.

Ordre des écrans : **Accueil → Agenda** (démo). Ensuite Inscriptions / Athlètes / Paiements **après le salon**.

**Critère :** Accueil et Agenda utilisables en AR + RTL, bascule FR/AR.

### APP-C4 — Parité après salon (ne pas faire maintenant)

- Guide : `WebView` sur `/guide` (route **publique**)
- Admin feedbacks (le web a la page, l’app a seulement l’envoi)
- Play Store (interdit tant que cleartext / HTTP)

---

## Déjà fait dans l’app (ne pas refaire)

- Login multi-club : champ **slug** (`club_slug`) — plus d’annuaire clients public
- Messages **429** / **500** / **409** dans `client.ts`
- Déconnexion **401**
- `UpdateGate`, `ErrorBoundary`, onboard, branding Nadi Connect
- 403 + bandeau **dans le source** (à **publier** via APP-A1)

---

## APIs à utiliser (ne pas en inventer)

| Besoin | Méthode | Chemin |
|--------|---------|--------|
| Login | POST form | `/api/v1/auth/login` (`username`, `password`, `club_slug`) |
| Inscription | POST JSON | `/api/v1/registrations` |
| Enfants parent | GET | `/api/v1/children` |
| Accueil mobile | GET | `/api/v1/mobile/home` |
| Notifications | GET | `/api/v1/notifications` (ou le chemin déjà branché dans Accueil) |
| Bootstrap club (suspendu / essai) | GET | `/api/v1/bootstrap` |
| Onboard club | POST | `/api/v1/club/onboard` |
| Athlètes | GET/POST/PATCH | `/api/v1/athletes` |

Tout le reste : même contrat que le site, documenté dans `docs/ORDRE_DEV_APP_ANDROID.md` §3–4.

---

## Livraison

À chaque fin de tâche : **APK versionné** + une ligne dans le **§9 Journal** de `docs/ORDRE_DEV_APP_ANDROID.md` + §15 de `docs/ORDRE_LOGICIEL_MAITRE.md`.  
Ne jamais livrer une feature app sans que le site / l’API la connaisse déjà.
