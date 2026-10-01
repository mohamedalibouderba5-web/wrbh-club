# Ordre de travail — Correctifs avant FormaTech Expo 2026

**Destinataire :** discussion de développement (agent IA + relecture développeur senior)
**Émis le :** 2026-10-01
**Échéance dure :** **12 octobre 2026** — FormaTech Expo, SAFEX Pavillon A, Alger (12→15 oct., 10h–18h)
**Budget :** 11 jours × 8 h = **88 heures**, dont ~20 h de préparation salon non-dev → **~68 h de développement réel**
**Source des constats :** `docs/AUDIT_COMMERCIALISATION_2026-10-01.md`

> **Règle absolue de cet ordre : aucune nouvelle fonctionnalité non listée ici.**
> Le produit a déjà 116 endpoints et 37 modèles pour 5,4 % de couverture de tests.
> Le risque n'est pas le manque de features, c'est la régression non détectée.

---

## 0. Contexte de décision (à lire avant de coder)

| Fait établi | Conséquence sur cet ordre |
|-------------|---------------------------|
| `POST /registrations` renvoie HTTP 500 en production pour **tous** les clubs | Priorité 1 absolue. Rien d'autre ne compte avant. |
| Les comptes parents sont créés `club_id = NULL` → visibles par tous les clubs | Priorité 2. Bloquant juridique (loi 18-07) et commercial. |
| Production en HTTP sur IP nue → `isSecureContext = false`, PWA inopérante | Priorité 3. Un stand de salon ne peut pas montrer « Non sécurisé ». |
| Aucune sauvegarde automatique | Priorité 4. Question n°1 d'un acheteur sérieux. |
| Concurrent algérien **Almawarid** (Oran) vend déjà « hébergement en Algérie + conforme loi 18-07 + paiement CIB/Edahabia » | Il faut une réponse préparée, pas un silence. Voir §6. |
| Loi 18-07 art. 12 : **déclaration préalable ANPDP obligatoire**, récépissé sous 48 h | À lancer **aujourd'hui**, hors dev. Voir §6. |
| FormaTech est un salon **formation / technologies de gestion**, pas un salon sport. Ministère de la Jeunesse partenaire | Le pitch doit parler « gestion » et « jeunesse / clubs », pas « logiciel de foot ». |
| 40 clubs = ~8 000 athlètes, ~5 000 comptes | **Aucun problème de capacité.** Voir §5. Ne pas perdre une heure d'optimisation. |

---

## 1. LOT A — Remettre le produit en marche (priorité 1, ~6 h)

### A1 — Déployer le correctif `parents.py` **(bloquant produit)**

Le code commité dans `HEAD` est incohérent : `backend/app/api/club.py` appelle `ensure_parent_account(..., club_id=club_id)` alors que la signature de `backend/app/services/parents.py` dans `HEAD` ne déclare pas ce paramètre.

```
TypeError: ensure_parent_account() got an unexpected keyword argument 'club_id'
```

Le correctif existe déjà dans la copie de travail (`git status` : ` M backend/app/services/parents.py`). **Il n'a jamais été commité.**

**À faire :**
1. Relire le diff de `backend/app/services/parents.py` et le commiter.
2. Déployer sur le VPS.
3. Vérifier en production : créer une inscription avec un téléphone parent → doit renvoyer `200`.

**Critère d'acceptation :** `backend/tests/test_registration_flow.py::test_registration_with_parent_phone_succeeds` passe, **et** une inscription réelle aboutit en production.

### A2 — Cloisonner les comptes parents **(bloquant juridique)**

Trois des quatre appels à `ensure_parent_account` omettent `club_id`. Les parents sont donc créés avec `club_id = NULL`, et comme presque toutes les requêtes filtrent avec `or_(club_id == X, club_id IS NULL)`, **une ligne NULL est visible par tous les clubs de la plateforme**.

Vérifié en production : 5 parents créés dans un club de test sont apparus dans la liste des comptes du club réel WRBH.

**À corriger :**

| Fichier | Ligne | Action |
|---------|-------|--------|
| `backend/app/api/club.py` | ~1657 (POST `/athletes`) | ajouter `club_id=club_id` |
| `backend/app/api/club.py` | ~1789 (PATCH `/athletes/{id}`) | ajouter `club_id=club_id` |
| `backend/app/api/club.py` | ~2777 | ajouter `club_id=club_id` |

Vérifier dans chaque fonction que la variable `club_id` est bien celle de `Depends(get_current_club_id)`.

**⚠ Le problème est plus large que les parents — recensement du 2026-10-01 :**

**27 modèles sur 35 ont un `club_id` nullable.** Comme les lectures filtrent avec `or_(club_id == X, club_id IS NULL)`, **chacun de ces 27 modèles fuite vers tous les clubs dès qu'un seul site de création oublie `club_id`.**

Modèles à `club_id` nullable : `User`, `Category`, `Team`, `TeamCoach`, `Athlete`, `ParentChild`, `EmergencyContact`, `TeamMembership`, `Registration`, `Attachment`, `EventException`, `Convocation`, `Attendance`, `FeePlan`, `FeeInstallment`, `Payment`, `Receipt`, `CoachPayroll`, `MessageThread`, `Message`, `Notification`, `ParentNotificationPref`, `PushToken`, `InventoryAssignment`, `AuditLog`, `MediaObject`, `SystemFeedbackEvent`.

Seuls `Season`, `Discipline`, `Venue`, `Event`, `LedgerEntry`, `Announcement`, `InventoryItem`, `Document` sont sains (`club_id` NOT NULL). **Prendre ces 8 comme modèle de référence.**

Sites de création fautifs **déjà confirmés** :

| Modèle | Site | Constat |
|--------|------|---------|
| `User` (parents) | `club.py:1657`, `1789`, `2777` | Fuite **prouvée en production** |
| `ParentChild` | `parents.py:74-81` quand `club_id` est omis | NULL par ricochet |
| `Notification` | `notify.py:16` — `Notification(user_id=…)` **sans `club_id`** | **Toutes** les notifications sont créées `club_id = NULL` |

**Méthode imposée au développeur :** ne pas corriger au cas par cas. Pour **chacun** des 27 modèles, lister tous les sites d'instanciation (`grep` sur `Modele(`) et vérifier que `club_id` est fourni. Produire la liste dans le commit.

**Puis**, migration de rattrapage (Alembic, pas de SQL manuel) :

```sql
-- Rattacher les parents NULL au club de leur enfant
UPDATE users u SET club_id = sub.club_id
FROM (
  SELECT pc.parent_id, MIN(a.club_id) AS club_id
  FROM parent_children pc
  JOIN athletes a ON a.id = pc.athlete_id
  WHERE a.club_id IS NOT NULL
  GROUP BY pc.parent_id
) sub
WHERE u.id = sub.parent_id AND u.club_id IS NULL AND u.role = 'parent';
```

**Critère d'acceptation :** retirer le marqueur `xfail` de `test_athlete_creation_scopes_parent_account` → le test passe. Et `SELECT count(*) FROM users WHERE club_id IS NULL AND role='parent'` renvoie `0`.

### A3 — Supprimer le filtre `club_id IS NULL` **(dette structurelle)**

Une fois A2 déployé et le rattrapage fait, le motif `or_(Model.club_id == club_id, Model.club_id.is_(None))` n'a plus de raison d'être : c'était une tolérance de migration. Tant qu'il existe, **toute ligne créée avec un `club_id` oublié fuite silencieusement vers tous les clients.**

**À faire :**
1. Rendre `club_id` **NOT NULL** sur les tables métier (migration Alembic).
2. Remplacer le motif par un `Model.club_id == club_id` strict dans `club.py`, `finance.py`, `feedback.py`.
3. Dans `backend/app/core/tenant.py:50-53`, supprimer la tolérance `obj_club is not None` :

```python
def assert_same_club(obj, club_id: int) -> None:
    obj_club = getattr(obj, "club_id", None)
    if obj_club is None or int(obj_club) != int(club_id):
        raise HTTPException(status_code=404, detail="Ressource introuvable")
```

> `backend/app/api/agenda.py:112` filtre déjà strictement (`Event.club_id == club_id`) sans la tolérance NULL. **Prendre ce fichier comme modèle de référence.**

**Critère d'acceptation :** un test qui insère une ligne `club_id = NULL` et vérifie qu'aucun club ne la voit.

### A4 — Onboarding : 409 au lieu de 500

`POST /club/onboard` plante en 500 si le téléphone admin existe déjà :

```
IntegrityError: duplicate key violates unique constraint "ix_users_phone"
```

`User.email` et `User.phone` sont uniques **globalement** (`backend/app/models/__init__.py:70-71`).

**Court terme (obligatoire avant le salon) :** vérifier le téléphone **avant** l'insertion, comme c'est déjà fait pour l'email (`auth.py:442`), et renvoyer `409 "Téléphone admin déjà utilisé"`. Ajouter en plus un `try/except IntegrityError` → `409` pour couvrir les courses.

**Moyen terme (après le salon, ne pas faire maintenant) :** passer en unicité composite `(club_id, phone)` et `(club_id, email)`. C'est une migration lourde : en Algérie un parent ayant un enfant dans deux clubs est courant, le blocage actuel finira par gêner.

### A5 — Purger les données de test de production

8 clubs `zztest-*` sont encore dans l'annuaire public, plus 5 comptes parents et 2 comptes admin de test. Le SQL complet est en **§7 de l'audit**. Faire un `backup_db.sh` avant.

**Critère d'acceptation :** `GET /api/v1/club/list` ne renvoie que `wrbh` et `demo-judo-978`.

### A6 — Verrouiller par des tests

C'est **la** cause racine de A1 : 490 lignes de tests pour 9 001 lignes de backend (**5,4 %**). Aucun test ne couvrait l'inscription.

**À écrire (minimum) :**
- parcours inscription complet : création → approbation → échéances → paiement → reçu
- onboarding d'un club, puis vérification qu'il voit **zéro** donnée métier
- création d'athlète + parent, vérification du `club_id` sur **toutes** les entités créées
- un test par endpoint de maintenance vérifiant qu'il ne touche que le club appelant

**Correction de ce critère (vérification du 2026-10-01, 13h20).** La couverture réelle mesurée est de **43 %** — mon chiffre initial de « 5,4 % » était un ratio lignes-de-test / lignes-de-code, pas une couverture. Le seuil de 20 % était donc déjà dépassé et ne veut rien dire.

Le vrai problème est **où** se trouve la couverture. Le total de 43 % est gonflé par les modèles, la config et les schémas, couverts par simple import. La logique métier, elle, est découverte :

| Module | Couverture | Lignes non testées |
|--------|-----------|--------------------|
| `finance.py` | **16 %** | 477 |
| `uploads.py` | 22 % | 96 |
| `agenda.py` | 23 % | 318 |
| `club.py` | 24 % | 1 071 |
| `mobile.py` | 25 % | 58 |
| `auth.py` | 28 % | 241 |

**`finance.py` à 16 % est le point le plus inquiétant : c'est le module qui manipule l'argent des clubs.**

**Nouveau critère d'acceptation :** ne pas viser un pourcentage global, mais couvrir explicitement ces parcours :

- [x] inscription complète avec téléphone parent *(fait — `test_registration_flow.py`)*
- [ ] paiement : échéance → encaissement → reçu → rapprochement au tableau de bord
- [ ] modification des constantes de cotisation et répercussion sur les échéances ouvertes
- [ ] cycle de séance : création → approbation → démarrage → clôture → présences
- [x] notification de rôle à deux clubs (voir A8)
- [x] club suspendu : écriture refusée, lecture et export autorisés (voir A7)
- [ ] upload de photo et accès au média depuis un autre club (voir D6)

Objectif chiffré utile : **`finance.py` et `club.py` au-dessus de 50 %.**

### A10 — La production n'exécute aucun commit identifiable **(risque de régression)**

Vérifié en production le 2026-10-01 à 13h20 : `POST /club/onboard` avec un téléphone déjà utilisé renvoie `409 "Téléphone admin déjà utilisé"`. Or ce message **n'existe que dans la copie de travail**, pas dans `HEAD`.

Autrement dit : **le serveur de production exécute du code non commité.** État relevé :

| Correctif | Dans `HEAD` (git) | Actif en production |
|-----------|-------------------|---------------------|
| A1 `parents.py` | oui (`0e0b02d`) | oui |
| A2 `club.py` ligne ~1657 (POST `/athletes`) | **non** | **oui** |
| A2 `club.py` ligne ~1790 (PATCH `/athletes`) | **non** | **oui** |
| A2 `club.py` ligne ~2779 | **non** | **oui** |
| A4 onboard → 409 | **non** | **oui** |
| A7 suspension | **non** | non vérifiable sans suspendre un club |
| A8 `notify_role` | **non** | non vérifiable sans second club |

C'est exactement la classe de problème qui a causé **P0-1**, simplement inversée : hier le code commité était incohérent avec lui-même, aujourd'hui la production est en avance sur git. Conséquences concrètes :

1. **Aucun retour arrière possible.** Si un correctif casse quelque chose pendant le salon, vous ne pouvez pas revenir à l'état qui tourne : il n'existe dans aucun commit.
2. **Le prochain déploiement depuis git fera régresser la production** — il réintroduirait le 500 de l'onboarding et la fuite des parents sur la création d'athlète.
3. **Si le poste du développeur tombe en panne, le code de production est perdu.**
4. Aucune relecture possible par le développeur senior sur ce qui tourne réellement.
5. Le numéro de version est resté à **1.17.0** alors que le code a changé — `/health` ne permet plus de savoir ce qui est déployé.

**À faire immédiatement, avant toute autre tâche :**
1. Commiter l'intégralité de la copie de travail backend (`auth.py`, `club.py`, `finance.py`, `tenant.py`, `schemas/__init__.py`, `notify.py`).
2. Incrémenter la version applicative et l'exposer dans `/health`.
3. Redéployer **depuis le commit**, puis revérifier le `409` de l'onboarding et le `200` de l'inscription.
4. **Règle permanente : plus aucun déploiement depuis une copie de travail.** Déploiement = `git pull` sur un tag ou un SHA, et `/health` doit renvoyer ce SHA.

**Critère d'acceptation :** `/health` expose le SHA du commit déployé, et ce SHA existe dans l'historique git.

### A7 — La suspension d'un club est inopérante **(bloquant modèle d'abonnement)**

Constat vérifié le 2026-10-01 :

| Dépendance | Vérifie `status == "suspended"` ? | Nombre d'endpoints qui l'utilisent |
|------------|----------------------------------|-----------------------------------|
| `get_current_club` (`tenant.py:25-40`) | **Oui** | **0** |
| `get_current_club_id` (`tenant.py:14-22`) | **Non** | **78** |

Le statut n'est contrôlé qu'**au login** (`auth.py:73-74`). Conséquence directe :

> **Vous ne pouvez pas couper l'accès à un client qui ne paie pas.** Il suffit qu'il ne se déconnecte pas : son jeton reste valide 12 h, et les 78 endpoints continuent de le servir. Passer `Club.status = "suspended"` en base ne change rien pour lui.

C'est un bloquant du modèle commercial lui-même : vendre un abonnement sans pouvoir le révoquer n'est pas tenable à 40 clubs.

**À faire :**
1. Déplacer le contrôle de statut dans `get_current_club_id` (il charge déjà l'utilisateur, il faut y ajouter la lecture du club — mettre en cache si besoin de performance).
2. Autoriser la **lecture et l'export** pour un club suspendu, bloquer **l'écriture** : un client qui arrête de payer doit pouvoir récupérer ses données, pas continuer à travailler. C'est aussi une obligation morale vis-à-vis des clubs.
3. Réduire la durée du jeton (`config.py:11` → 12 h) ou introduire une révocation, sinon la suspension reste différée jusqu'à l'expiration.

**Critère d'acceptation :** un test qui passe un club en `suspended`, réutilise un jeton **déjà émis**, et vérifie que `POST /athletes` renvoie `403` alors que `GET /athletes` renvoie `200`.

### A8 — `notify_role` notifie tous les clubs de la plateforme

`backend/app/services/notify.py:56-60` :

```python
def notify_role(db: Session, role: str, title: str, body: str, kind: str = "info") -> int:
    users = db.query(User).filter(User.role == role, User.is_active.is_(True)).all()
```

**Aucun filtre club.** Quand un club déclenche une notification vers « staff » ou « direction », **tous les staffs et directions de tous les clubs la reçoivent**, avec le titre et le corps du message.

Contrairement à A2 qui est une fuite *passive* (données visibles si on regarde), celle-ci est une fuite **active** : vous envoyez le contenu d'un club dans la boîte de notification de vos autres clients. À 40 clubs, chaque action d'un club notifie les 39 autres.

**À faire :**
1. Ajouter un paramètre `club_id` obligatoire à `notify_role` et filtrer dessus.
2. Corriger `notify_user` (`notify.py:16`) pour renseigner `Notification.club_id` — voir A2.
3. Auditer les appelants de `notify_role` dans `club.py` et `agenda.py`.

**Critère d'acceptation :** un test à deux clubs vérifiant qu'une notification de rôle déclenchée par le club A ne crée **aucune** `Notification` pour un utilisateur du club B.

### A9 — Aucun moyen de suspendre ou supprimer un club

Vérifié : **aucun endpoint** ne permet de changer le statut d'un club ni de le supprimer. C'est ce qui m'a empêché de nettoyer les 8 clubs de test de l'audit (purge SQL manuelle requise).

Pour gérer 40 clients, il faut pouvoir : suspendre (impayé), réactiver, et supprimer (fin de contrat, avec export préalable). Sans ça, chaque churn devient une intervention SQL en production.

**À faire :** endpoints super-admin `PATCH /admin/clubs/{id}` (statut, plan, `trial_ends_on`) et `DELETE /admin/clubs/{id}` (avec confirmation explicite et export préalable). À brancher sur la console du lot C4.

**Note de séquencement :** A9 n'est pas requis pour le salon, mais **A7 l'est** — sans A7, A9 ne sert à rien puisque la suspension n'a aucun effet.

---

## 2. LOT B — Rendre le stand défendable (priorité 2, ~14 h)

### B1 — Nom de domaine + HTTPS **(bloquant salon)**

Aujourd'hui : `http://46.224.38.201:8080`. Vérifié dans le navigateur :

```json
{"isSecureContext": false, "hasServiceWorker": false, "crypto_subtle": false}
```

L'API `serviceWorker` est **absente**, donc : PWA non installable, pas de hors-ligne, pas de push web, bannière de mise à jour PWA = code mort. Et mots de passe en clair sur le réseau.

**À faire :**
1. Acheter un domaine (`.dz` si le dossier est faisable à temps, sinon `.com` — **ne pas bloquer le salon sur un `.dz`**).
2. Reverse proxy TLS devant les ports 8080/8081. **Caddy** est recommandé : certificat automatique, 5 lignes de config.
3. `api.<domaine>` → 8081, `<domaine>` → 8080. Redirection 301 HTTP→HTTPS.
4. Mettre à jour `CORS_ORIGINS` sur le VPS.
5. `mobile/app.json` : `extra.apiUrl` en `https://api.<domaine>`, **retirer** `android.usesCleartextTraffic`, rebuild APK, publier, mettre à jour `ANDROID_APK_URL`.
6. Revérifier `isSecureContext === true` et que le service worker s'enregistre.

**Attention planning :** propagation DNS = plusieurs heures. **À lancer en J2 au plus tard**, pas en J9.

### B2 — Sauvegarde automatique + test de restauration

`deploy/hetzner/backup_db.sh` est correct mais **manuel** (« Run on ali-server »), aucun cron dans le dépôt, et les dumps restent **sur le même serveur**.

**À faire :**
1. Cron quotidien (02:00 Alger).
2. Copie hors-site (autre VPS, S3, ou simplement `rclone` vers un stockage distinct).
3. **Faire une restauration réelle sur une base jetable et la documenter.** Une sauvegarde non testée n'est pas une sauvegarde.
4. Vérifier la taille du dump : les photos sont stockées en base (`media.py:16`, 2 Mo max par image). À 8 000 athlètes, le dump devient lourd — mesurer et décider si les blobs migrent sur disque après le salon.

### B3 — Rate-limit par compte, pas par IP

`backend/app/core/config.py:36-37` : **10 requêtes / 5 min par IP**, partagé entre login et onboarding (`auth.py:50-64`).

Derrière le NAT d'un opérateur mobile algérien ou le wifi du club, le 11ᵉ parent qui se connecte est bloqué. **Et sur le stand, le wifi SAFEX est une IP unique partagée : vous vous bloquerez vous-même en démo.**

**À faire :**
- Clé de limitation = identifiant du compte, avec un plafond IP beaucoup plus large (ex. 100/5 min).
- Ne pas appliquer le compteur de *login* à l'*onboarding* : message actuel « Trop de tentatives de connexion » lors d'une création de club, incompréhensible.
- Côté web et app : message dédié sur `429`, sans réessai automatique en boucle.

### B4 — Fermer l'annuaire public des clients

`GET /api/v1/club/list` renvoie **sans authentification** la liste de tous les clubs. Un prospect voit tous vos autres clients — et à 40 clubs, c'est votre portefeuille commercial en libre accès.

**À faire :** supprimer l'endpoint public, ou le restreindre aux clubs marqués `is_platform` / vitrine. Le login par slug saisi à la main suffit.

### B5 — Rendre `/download` et `/guide` publics

`web/src/App.tsx` place ces routes derrière l'authentification, alors que `LoginPage.tsx:223`, `InstallPage.tsx:61` et `PilotPage.tsx:86` y renvoient. Un visiteur du salon qui scanne un QR pour récupérer l'APK tombe sur le login.

**À faire :** déplacer `/download` et `/guide` dans les routes publiques de `App.tsx`.

### B6 — Décommissionner Render

`wrbh-api.onrender.com` est en **timeout**, alors que `wrbh-web.onrender.com` répond encore et pointe vers cette API morte. Si un visiteur tombe sur cette URL, il voit un produit cassé.

**À faire :** supprimer les deux services Render, ou rediriger le web Render vers le nouveau domaine.

---

## 3. LOT C — Ce que le salon exige vraiment (priorité 3, ~22 h)

### C1 — Jeu de démonstration crédible **(l'actif n°1 du stand)**

Un stand ne vend pas une base vide. Il faut **3 clubs de démo** remplis, cohérents, présentables :

| Club | Sport | Contenu attendu |
|------|-------|-----------------|
| Club football jeunes | football | ~120 athlètes U7→U17, 8 équipes, saison complète, cotisations avec impayés réalistes, agenda du mois |
| Club multisport | judo + natation + karaté | ~80 athlètes, montre la force multi-disciplines |
| Petite école de sport | handball | ~30 athlètes, montre que l'outil convient aussi aux petites structures |

Exigences : **noms algériens réalistes**, photos neutres ou avatars, montants en DZD cohérents avec le marché, quelques impayés et quelques retards pour que les tableaux de bord soient parlants, séances passées **et** futures.

**À faire :** un script de seed idempotent et rejouable (`backend/scripts/seed_demo.py`), pour pouvoir **réinitialiser la démo entre deux visiteurs**.

### C2 — Licences fédérales et certificats médicaux

Ce sont **les deux premières questions** que posera tout gérant de club algérien. Aujourd'hui, la licence est un simple champ texte libre (`license_number`) et le certificat médical n'existe pas.

**Minimum viable pour le salon :**
- `license_number`, `license_valid_until`, `license_status`
- `medical_cert_date`, `medical_cert_valid_until`
- un indicateur visuel « expire dans moins de 30 jours » sur la fiche athlète et dans la liste
- un filtre « licences à renouveler » / « certificats expirés »
- une ligne dans le tableau de bord

Ne pas construire l'export au format fédération maintenant : chaque fédération a le sien, c'est à faire **après** avoir écouté les deux premiers clients.

### C3 — Arabe sur les modules de gestion

`web/src/pages/FinancePage.tsx` (60 Ko) n'utilise pas `useI18n` : mois, onglets, tableaux, messages sont en français en dur. Idem `TeamsPage.tsx` et `InventoryPage.tsx`.

Sur un salon à Alger, une partie des visiteurs demandera la démo en arabe. Montrer une interface financière entièrement en français après avoir promis le bilingue est un mauvais moment.

**À faire :** passer Finance, Équipes et Matériel par `useI18n`, vérifier le RTL. Priorité : Finance d'abord.

### C4 — Console super-admin, en lecture seule

`Role.SUPERADMIN` existe (`core/roles.py:5`) mais `is_superadmin` n'est **utilisé nulle part**, et `get_current_club_id` **bloque** un super-admin puisqu'il n'a pas de `club_id` (`tenant.py:43-44`).

Pour vendre « plateforme multi-clubs », il faut pouvoir montrer un écran listant les clubs, leur plan, leur date de fin d'essai et leur nombre d'athlètes.

**À faire :** une vue super-admin **en lecture seule** — liste des clubs + compteurs. Pas d'édition, pas de bascule de tenant. 4 h maximum.

### C5 — Rendre l'essai réel

`trial_ends_on` est écrit à l'onboarding (`auth.py:454-463`) mais **jamais relu**. J'ai créé 15 athlètes sur un plan `discovery` sans aucun blocage. Le champ `plan` n'est utilisé nulle part dans le code.

**Minimum :** un bandeau « essai — J-n » dans l'application, et un blocage en écriture à l'expiration (lecture et export restent autorisés). Un plafond d'athlètes par plan si le temps le permet.

**Critère d'acceptation :** un club dont `trial_ends_on` est dans le passé ne peut plus créer d'athlète, mais peut toujours consulter et exporter.

---

## 4. LOT D — Hygiène, si et seulement si le temps reste (~10 h)

Par ordre de valeur décroissante. **S'arrêter dès que le planning se tend.**

| # | Sujet | Détail |
|---|-------|--------|
| D1 | Saison courante par club | `finance.py:92-94`, `club.py:114`, `club.py:883-886`, `mobile.py:36` font `Season.is_current == True` **sans filtre club**. Plusieurs clubs ont simultanément `is_current = true` : un paiement rapide sans `season_id` peut être rattaché à la saison d'un autre club (`finance.py:411`). |
| D2 | Endpoints de maintenance | `cleanup-tests`, `backfill-fees`, `prune-old-teams` (`club.py:1877-2008`) et `cleanup-audit` (`auth.py:579-614`) agissent sur **toute la plateforme**. Les cadrer sur le club appelant. |
| D3 | Suppression d'un compte parent | `DELETE /auth/users/{id}` répond « Seuls coach / staff peuvent être supprimés ici ». Aucun moyen d'effacer les données d'un parent — exigence directe de la loi 18-07 (droit d'opposition, art. 36 ; amende de 500 000 DA en cas de refus). |
| D4 | Contrôle d'accès par route | La navigation masque les modules par rôle mais React Router ne bloque pas l'URL directe : un parent peut ouvrir `/finance`. L'API protège, donc pas de fuite, mais c'est incohérent en démo. |
| D5 | Champs nuls | Les athlètes créés par l'API ressortent avec `list_number`, `age` et `category_name` à `null`. Le dashboard finance renvoie `season_name: null` même pour WRBH. |
| D6 | Upload / média | `uploads.py:45-47` et `59-61` : un compte staff contourne la vérification de tenant sur la cible d'upload et peut consulter n'importe quel média. |
| D7 | Mot de passe par défaut | `default_admin_password = "admin123"` en dur dans `config.py:21`. |
| D8 | `Role.ADMIN` court-circuite tous les contrôles de rôle (`deps.py:48-50`). |
| D9 | Échéances mensuelles | `ensure_season_fee_bundle` (`fees.py:303-306`) ne crée que « inscription » et « assurance ». Les mensualités sont à générer à la main. |
| D10 | `fees.py:52-56` | `_resolve_club_id` retombe sur `db.query(Club).first()` = WRBH : un club sans `club_id` hérite des tarifs de WRBH. |
| D11 | Politique de mot de passe incohérente | `POST /club/onboard` accepte un mot de passe admin de 8 caractères sans autre règle, alors que `change-password` applique une liste de mots de passe faibles (`auth.py:150-154`). Le compte le plus privilégié est le moins protégé. |
| D12 | JWT sans révocation | `access_token_expire_minutes = 60 * 12` (`config.py:11`), aucun *refresh token*, aucune révocation. Et `.env.example:5` annonce 10080 minutes (7 jours) — incohérence à trancher. Lié à **A7** : plus le jeton est long, plus la suspension est différée. |
| D13 | Aucune journalisation applicative | Le module `logging` n'est utilisé nulle part dans `backend/app/`. L'observabilité repose sur Sentry (optionnel) et le collecteur de feedback. Pour dépanner 40 clubs à distance, il faut des logs structurés avec le `club_id`. |
| D14 | Erreurs silencieuses côté web | `web/src/pages/InventoryPage.tsx:54-56` avale les erreurs d'API (`.catch(() => [])`). L'utilisateur voit une liste vide au lieu d'un message : indistinguable d'un vrai état vide. À auditer sur les autres pages. |
| D15 | `GET /exports/export` renvoie 404 | Observé pendant l'audit. À vérifier : paramètres requis non documentés, ou route réellement cassée. Un export non fonctionnel est un argument de vente perdu. |
| D16 | Pagination manquante | `GET /inventory/items` (`finance.py:970-983`) et les listes d'équipes / disciplines font `.all()` sans pagination. Sans impact à 40 clubs, à traiter avant 200. |
| D17 | Lien de démo codé en dur | `web/src/pages/PilotPage.tsx:73` pointe vers le slug `demo-judo-978`. Si ce club est supprimé ou renommé, le bouton « Voir la démo live » casse. À rendre configurable avant le salon. |

---

## 5. Capacité pour 40 clubs — verdict technique

**Ne consacrez aucune heure à l'optimisation de performance.** Les chiffres :

| Métrique | À 40 clubs | Verdict |
|----------|-----------|---------|
| Athlètes | ~8 000 | Trivial pour PostgreSQL |
| Comptes utilisateurs | ~5 000 | Trivial |
| Échéances / paiements | ~150 000 lignes/an | Trivial |
| Temps de réponse mesuré aujourd'hui | < 0,3 s sur tous les endpoints testés | Confortable |

Les vraies limites à 40 clubs ne sont pas la capacité :

1. **Photos en base** (`media.py`) — jusqu'à 2 Mo par athlète dans PostgreSQL. À 8 000 athlètes, les sauvegardes deviennent lentes. À traiter **après** le salon, pas avant.
2. **Caches en mémoire de processus** — `fast_cache`, `_STATS_CACHE` (`club.py:81-83`, `986-987`) et le compteur de rate-limit (`auth.py:40`) sont par processus. Dès que vous passez à plusieurs workers, ils divergent. Garder **un seul worker** jusqu'à migration vers Redis.
3. **Pool de connexions** `pool_size=5, max_overflow=5` (`database.py:19-20`) — suffisant pour un worker, à relever si vous en ajoutez.
4. **VPS unique, partagé avec `/opt/esta`** — aucune redondance. Un incident = tous vos clients à l'arrêt simultanément. C'est un risque commercial, pas de capacité.

**Conclusion : votre plafond réel n'est pas technique, il est humain.** 40 clubs, c'est 40 onboardings, 40 formations, 40 canaux WhatsApp de support. Voir §7.

---

## 6. Actions non-dev à lancer aujourd'hui (hors des 88 h)

Ces points ne sont pas du code mais conditionnent la crédibilité du stand.

### 6.1 — Déclaration ANPDP (loi 18-07) — **à lancer aujourd'hui**

L'article 12 de la loi 18-07 soumet **tout** traitement de données personnelles à une **déclaration préalable** auprès de l'ANPDP. Le récépissé est délivré sous 48 h et le traitement peut démarrer dès sa réception. Le délai de mise en conformité est expiré depuis le 11 août 2023.

Vous traitez des données de **mineurs** : noms, dates de naissance, **groupe sanguin**, photos, téléphones de parents. C'est précisément le périmètre visé.

De plus, votre hébergement est en **Allemagne (Hetzner)**. Un transfert hors du territoire algérien relève du régime d'**autorisation préalable** (art. 44-45), avec pour exception notable le **consentement exprès** de la personne concernée.

**À faire aujourd'hui, en parallèle du dev :**
1. Déposer la déclaration ANPDP (`anpdp.dz`) — c'est gratuit et rapide.
2. Ajouter une case de **consentement exprès** sur le formulaire d'inscription, mentionnant l'hébergement hors d'Algérie (ancrage sur l'exception de l'art. 45).
3. Rédiger une politique de confidentialité et la publier sur le site.
4. Préparer une réponse honnête à la question « où sont mes données ? » — voir 6.2.

Sur un salon dont les ministères de l'Économie de la connaissance et de la Poste et Télécommunications sont partenaires, pouvoir montrer un récépissé ANPDP est un **argument de vente**, pas une formalité.

### 6.2 — Réponse préparée sur l'hébergement

Votre concurrent algérien **Almawarid** (Bir El Djir, Oran) met en avant exactement ce que vous n'avez pas : *« Vos données restent en Algérie. Conforme à la loi 18-07 »* et le paiement CIB/Edahabia via PayPart.dz.

**Ne mentez pas et n'improvisez pas.** Position recommandée :

> « Aujourd'hui nos serveurs sont en Europe, chez un hébergeur professionnel, avec sauvegardes chiffrées. Notre déclaration ANPDP est déposée et le consentement est recueilli à l'inscription. Une offre avec hébergement en Algérie est à notre feuille de route pour [trimestre] — et pour un client qui l'exige, nous pouvons l'installer sur son propre serveur. »

L'option **installation chez le client** est d'ailleurs un argument fort auprès des grosses structures et des directions de jeunesse et sports.

### 6.3 — Paiement : Chargily Pay, mais **pas avant le salon**

Pour encaisser des abonnements en Algérie, la voie technique est **Chargily Pay** : passerelle algérienne, cartes **CIB (SATIM)** et **EDAHABIA (Algérie Poste)**, API gratuite, sandbox, webhooks, et un **SDK Python officiel** (`chargily-pay-python`) — directement compatible avec votre backend FastAPI.

**Mais ne l'intégrez pas avant le 12 octobre.** Sur un salon, vous collectez des contacts et vous signez des intentions ; vous n'avez pas besoin d'un paiement en ligne. Intégrer une passerelle de paiement en 11 jours, en plus des bloquants P0, c'est prendre le risque d'arriver avec un produit à nouveau cassé.

**Planifier Chargily après le salon** (environ 3 à 5 jours : checkout, webhook signé, états `PENDING/PAID/FAILED/EXPIRED`, rapprochement avec `Club.plan` et `trial_ends_on`).

### 6.4 — Dispositif de démonstration sur le stand

Ce point est traité comme un bloquant technique, parce qu'il en est un.

1. **Démo locale obligatoire.** Le réseau d'un hall d'exposition est saturé et instable. Faites tourner une copie complète sur le portable (`docker-compose`), et un téléphone avec l'APK pointant vers ce portable via un point d'accès local. **Ne jamais dépendre du wifi SAFEX ni de la 4G.**
2. **Deux appareils** : un portable pour l'admin web, un téléphone Android pour la vue parent/coach. C'est la démonstration qui convainc : « le parent reçoit la notification de la séance ».
3. **Gel du code le 10 octobre.** Aucun déploiement pendant les 4 jours de salon.
4. **Réinitialisation de la démo** entre visiteurs (script C1).
5. **Capture de contacts** : QR vers un formulaire simple. Pas d'inscription self-serve sur le stand — vous ne voulez pas 30 clubs fantômes dans votre base.
6. Compte de démonstration dédié, **jamais** le club WRBH réel : ce sont des données de mineurs.

Les visuels de stand existent déjà dans `docs/design-safex/` et le script oral dans `docs/DEMO_SCRIPTEE_NADI_CONNECT.md` — à relire et adapter au public « formation / gestion » de FormaTech.

---

## 7. Planning jour par jour

| Jour | Date | Contenu | Heures |
|------|------|---------|--------|
| J1 | 1 oct. | **A1, A4, A5** + début **A2** (recensement des 27 modèles) + lancer déclaration ANPDP + **acheter le domaine** | 8 |
| J2 | 2 oct. | **B1** (DNS, Caddy, TLS, CORS, APK https) — à lancer tôt pour la propagation | 8 |
| J3 | 3 oct. | **B2** (sauvegarde + restauration testée), **B3**, **B4**, **B5**, **B6** | 8 |
| J4 | 4 oct. | **C1** script de seed + 3 clubs de démo remplis | 8 |
| J5 | 5 oct. | **C2** licences + certificats médicaux | 8 |
| J6 | 6 oct. | **C3** arabe sur Finance (puis Équipes / Matériel) | 8 |
| J7 | 7 oct. | **C4** console super-admin + **C5** essai réel | 8 |
| J8 | 8 oct. | **A2** (fin : 27 modèles) + **A3** (`club_id` NOT NULL + filtres stricts) + **A7** (suspension) + **A8** (`notify_role`) + **A6** tests | 8 |
| J9 | 9 oct. | **Recette complète + revue du développeur senior** + corrections | 8 |
| J10 | 10 oct. | **Gel du code.** Dispositif de démo (6.4), répétition, matériel imprimé | 8 |
| J11 | 11 oct. | Répétition finale, sauvegarde, plan de secours, logistique stand | 8 |

**Ce qui n'est PAS dans ce planning, volontairement :** paiement en ligne, facturation récurrente, quotas par plan détaillés, sous-domaine par club, export format fédération, découpage de `club.py`, migration des photos hors base, Redis, multi-worker. **Tout cela vient après le 15 octobre.**

**Variable d'ajustement :** si le planning glisse, sacrifiez dans cet ordre : D (tout), puis **A9**, puis C4, puis C3 (gardez juste Finance), puis C2, puis **A3** (le filtre strict peut attendre si A2 est fait proprement).

**Ne sacrifiez jamais : A1, A2, A4, A5, A7, A8, A10, B1, B2, ni J9/J10.**

**A10 est à traiter avant tout le reste** : tant que la production exécute du code non commité, aucune autre tâche n'est fiable, et le prochain déploiement depuis git ferait régresser ce qui marche aujourd'hui.

Justification de A7 et A8 dans cette liste : A8 envoie activement le contenu d'un club chez vos autres clients, et sans A7 vous vendez un abonnement que vous ne pouvez pas révoquer. Ce sont des défauts qui se voient en démo et qui tuent un contrat.

**Charge ajoutée par ce complément (A7, A8, A9, D11→D17) :** environ **6 h**, absorbées en J8. Si J8 déborde, **basculez A9 et les D après le salon** — A7 et A8 restent en J8.

---

## 8. Critères de sortie (« prêt pour le salon »)

À cocher avant le 11 octobre au soir. Chaque ligne est vérifiable.

- [x] Créer une inscription avec téléphone parent renvoie `200` en production
- [x] `SELECT count(*) FROM users WHERE club_id IS NULL AND role='parent'` → `0`
- [x] `SELECT count(*) FROM notifications WHERE club_id IS NULL` → `0`
- [ ] Les 27 modèles à `club_id` nullable ont été passés en revue, liste fournie dans le commit
- [ ] Un club fraîchement créé voit **zéro** athlète, inscription, paiement, événement, compte parent d'un autre club
- [x] Un club passé en `suspended` ne peut plus écrire **avec un jeton déjà émis**, mais peut encore lire et exporter
- [x] Une notification de rôle déclenchée par le club A ne crée aucune notification chez le club B
- [ ] Le site répond en `https://` avec un certificat valide ; `isSecureContext === true`
- [ ] La PWA s'installe réellement depuis le navigateur du téléphone
- [ ] L'APK publié pointe vers `https://` et `usesCleartextTraffic` est retiré
- [x] Une sauvegarde automatique a tourné **et** une restauration a été testée
  - _(2026-10-01 : cron 02:15 UTC + `restore_test.sh` → RESTORE_OK clubs=10 sur Postgres 17 jetable)_
- [ ] 30 connexions successives depuis la même IP ne déclenchent pas de `429`
- [x] `GET /club/list` n'expose plus la liste des clients
- [x] `/download` et `/guide` s'ouvrent sans être connecté
- [ ] Les 3 clubs de démo sont remplis et le script de réinitialisation fonctionne
- [ ] La démonstration tourne **entièrement hors ligne** sur le portable + téléphone
- [ ] La démo en arabe est présentable sur Accueil, Athlètes, Inscriptions, Agenda **et Finance**
- [ ] Licence et certificat médical : saisie + alerte d'expiration visibles
- [ ] Récépissé ANPDP déposé ; politique de confidentialité en ligne
- [ ] Suite de tests verte, couverture backend ≥ 20 %
- [ ] Revue du développeur senior effectuée et remarques traitées
- [ ] Code gelé, sauvegarde de la base prise, aucun déploiement prévu du 12 au 15
- [x] `/health` expose le SHA du commit déployé, et ce SHA existe dans git (**A10**)
  - _(prod : `version=1.18.0`, `git_sha=f27f16150e7f`)_
- [ ] `finance.py` et `club.py` au-dessus de 50 % de couverture
- [ ] Le compte parent résiduel `VERIFYFIX…` (id 171) est supprimé du club de démo `demo-judo-978`

---

## 9. Après le salon — ordre indicatif

1. Chargily Pay (checkout + webhook) et facturation récurrente — 3 à 5 j
2. Quotas par plan, expiration d'essai complète — 2 j
3. Unicité `(club_id, phone)` / `(club_id, email)` — 2 j
4. Photos hors base + Redis + multi-worker — 3 j
5. Découpage de `club.py` (112 Ko) et `finance.py` (44 Ko) — 5 j
6. Export format fédération, **après** retour des 2 premiers clients — à cadrer
7. Offre « hébergement en Algérie » ou installation chez le client — à cadrer commercialement

---

## 10. Impact Android

Conformément à la règle du projet, voir le **Lot C** ajouté dans `docs/ORDRE_DEV_APP_ANDROID.md` §9. En résumé :

- **A1** : l'inscription depuis l'app est également en panne (même endpoint). Correctif backend uniquement, rien à coder côté app — mais afficher un message lisible sur `500`.
- **A2** : après cloisonnement, revalider `GET /children` et `GET /mobile/home` (un parent ne doit voir que les enfants de son club).
- **B1** : `app.json` en `https://`, retirer `usesCleartextTraffic`, rebuild + republier l'APK. Prérequis Play Store.
- **B3** : message dédié sur `429`, sans réessai en boucle.
- **A4** : afficher le `detail` du `409` dans `mobile/app/onboard.tsx`.
- **C2** : miroir des champs licence et certificat médical sur la fiche athlète.
