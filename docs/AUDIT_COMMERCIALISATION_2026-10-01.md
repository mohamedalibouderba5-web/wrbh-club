# Audit de commercialisation — Nadi Connect

**Date :** 2026-10-01
**Périmètre :** backend FastAPI, site web React, app Android Expo, production Hetzner `46.224.38.201`
**Méthode :** lecture du code + **tests réels en production** (création de 10 clubs de test, 8 athlètes, inscriptions, paiements, agenda, sondes d'isolation inter-clubs)
**Données de test :** toutes préfixées `ZZTEST` — nettoyage décrit en §7

---

## 1. Verdict

| Question | Réponse |
|----------|---------|
| Prêt à vendre en self-serve (SaaS public) ? | **Non** |
| Prêt à vendre en pilote assisté ? | **Non — pas aujourd'hui** |
| Le produit est-il loin d'être vendable ? | **Non, il est proche** |

**Le rapport du 30/09 concluait « pilote payant : oui, conditionnel ». Cette conclusion n'est plus valable.** Les tests en production révèlent que **la création d'inscription — la fonction centrale du produit — renvoie HTTP 500 pour tous les clubs, y compris WRBH**. Tant que ce point n'est pas corrigé, aucune démo ni aucun pilote n'est possible.

La bonne nouvelle : la cause est identifiée précisément et le correctif tient en **un seul paramètre de fonction**, déjà écrit en local mais jamais commité.

Le socle métier est réellement bon : 197 athlètes et 112 000 DZD de cotisations gérés en production, isolation inter-clubs correcte sur les athlètes, validations métier pertinentes, agenda fonctionnel, tarifs définis en DZD, guide de formation bilingue.

---

## 2. Bloquants P0 — à corriger avant toute démo

### P0-1 — `POST /registrations` renvoie HTTP 500 (produit à l'arrêt)

**C'est le bloquant numéro un.** Toute création d'inscription par un admin ou un staff avec un téléphone parent échoue.

Trace récupérée du collecteur d'erreurs de production :

```
TypeError: ensure_parent_account() got an unexpected keyword argument 'club_id'
```

Cause : dans le code **commité et déployé**, `club.py` appelle la fonction avec `club_id=`, mais `parents.py` ne déclare pas ce paramètre.

```2402:2408:backend/app/api/club.py
            parent, temp_pw, created = ensure_parent_account(
                db,
                phone=parent_phone,
                full_name=parent_name,
                athlete_id=athlete_id,
                club_id=club_id,
            )
```

Or la signature de `parents.py` dans `HEAD` s'arrête à `athlete_id`. Les deux fichiers ont été commités de façon incohérente. Le correctif existe dans votre copie de travail (`git status` : ` M backend/app/services/parents.py`) mais n'a jamais été commité ni déployé.

**Preuve en production** — 3 scénarios testés, 3 échecs :

| Scénario | Résultat |
|----------|----------|
| Athlète sans téléphone, puis inscription avec téléphone neuf | HTTP 500 |
| Athlète avec téléphone parent, puis inscription même téléphone | HTTP 500 |
| Inscription créant l'athlète en une fois | HTTP 500 |

**Correctif :** commiter puis déployer `backend/app/services/parents.py`. Quelques minutes.
**Puis :** ajouter un test d'intégration sur le parcours inscription. Les 17 tests existants passent tous — aucun ne couvre ce flux, c'est précisément pourquoi le bug est parti en production.

### P0-2 — Les comptes parents fuitent entre tous les clubs

Les comptes parents sont créés avec `club_id = NULL`. Comme presque toutes les requêtes filtrent avec `or_(club_id == X, club_id IS NULL)`, **une ligne NULL est visible par tous les clubs de la plateforme**.

Cause : trois des quatre appels à `ensure_parent_account` omettent `club_id` — `club.py:1657` (création athlète), `club.py:1789` (modification athlète), `club.py:2777`.

**Preuve en production.** J'ai créé 5 parents depuis un club de test. Ils sont apparus dans la liste des comptes du **club réel WRBH** :

```
total users vus par WRBH (club_id=1) : 105
dont club_id = NULL                  : 5
   FUITE -> 165 parent 0771000000 ZZTEST Parent 0      club_id=None
   FUITE -> 168 parent 0779112233 ZZTEST Parent Partage club_id=None
```

Concrètement, avec deux clients réels : le club B voit les noms et **numéros de téléphone** des parents du club A. C'est rédhibitoire commercialement et juridiquement.

**Correctif :** passer `club_id=club_id` aux trois appels, puis rattacher les lignes NULL existantes.

### P0-3 — Aucun HTTPS, aucun nom de domaine

La production tourne en **HTTP brut sur une adresse IP**, ports 8080/8081. Aucune trace de certbot, Let's Encrypt ou nom de domaine dans les scripts de déploiement.

Conséquences vérifiées dans le navigateur sur `http://46.224.38.201:8080` :

```json
{"isSecureContext": false, "hasServiceWorker": false, "crypto_subtle": false}
```

L'API `serviceWorker` est **absente**. Donc, en production aujourd'hui :

- la PWA **ne peut pas** s'installer — la page « Installer l'app » est non fonctionnelle
- pas de mode hors-ligne, pas de notifications push web
- la bannière de mise à jour PWA dans `AppLayout` est du code mort
- mots de passe et jetons JWT circulent **en clair** sur Internet
- l'app Android communique en clair (`usesCleartextTraffic`), ce qui bloquerait une publication Play Store

Un club qui saisit des données d'enfants sur un site affiché « Non sécurisé » ne signera pas.

**Correctif :** domaine + reverse proxy TLS (Caddy ou nginx + certbot). Une demi-journée.

### P0-4 — Aucune sauvegarde automatique

`deploy/hetzner/backup_db.sh` existe et est correct, mais son en-tête dit « Run on ali-server: bash … » : il est **manuel**. Aucun cron ni timer systemd dans le dépôt, et les dumps restent **sur le même serveur** — aucune copie hors-site.

Vendre un abonnement en hébergeant les données de 197 enfants sans sauvegarde automatisée ni hors-site est un risque que je ne recommande pas de prendre.

**Correctif :** cron quotidien + copie hors-site. Deux heures.

### P0-5 — L'inscription d'un nouveau club plante sur un téléphone déjà utilisé

`POST /club/onboard` renvoie **HTTP 500 « Erreur serveur interne »** si le téléphone admin existe déjà :

```
IntegrityError: duplicate key value violates unique constraint "ix_users_phone"
DETAIL:  Key (phone)=(0550000000) already exists.
```

`User.email` et `User.phone` sont uniques **globalement**, pas par club (`models/__init__.py:70-71`). Deux clubs ne peuvent donc pas partager un numéro — alors qu'en Algérie, un parent ayant un enfant dans deux clubs est un cas courant.

À noter : via l'écran « Comptes », le refus est propre (`400 « Téléphone déjà utilisé »`). Seul l'onboarding plante en 500.

**Correctif court terme :** capturer l'`IntegrityError` et renvoyer un 409 explicite.
**Correctif de fond :** passer en unicité `(club_id, phone)` et `(club_id, email)`.

---

## 2 bis. Complément de vérification (même jour, après rédaction du §2)

Une relecture de couverture a mis au jour trois défauts supplémentaires, dont deux de gravité P0.

### P0-6 — La suspension d'un club n'a aucun effet

| Dépendance | Contrôle `status == "suspended"` | Endpoints l'utilisant |
|------------|----------------------------------|----------------------|
| `get_current_club` (`tenant.py:25-40`) | **oui** | **0** |
| `get_current_club_id` (`tenant.py:14-22`) | **non** | **78** |

Le statut n'est lu qu'au login (`auth.py:73-74`). Un client suspendu qui ne se déconnecte pas continue donc à travailler normalement pendant toute la validité de son jeton (12 h), et il suffit qu'il se reconnecte… non : la reconnexion échoue, mais rien ne l'y oblige.

**Conséquence commerciale : vous ne pouvez pas révoquer l'accès d'un client qui ne paie pas.** Vendre un abonnement récurrent sans levier de coupure n'est pas tenable.

### P0-7 — `notify_role` notifie tous les clubs

```56:60:backend/app/services/notify.py
def notify_role(db: Session, role: str, title: str, body: str, kind: str = "info") -> int:
    users = db.query(User).filter(User.role == role, User.is_active.is_(True)).all()
```

Aucun filtre club. Une notification destinée au « staff » ou à la « direction » part vers **tous les staffs et directions de la plateforme**, titre et corps compris.

C'est une fuite **active**, à distinguer de P0-2 qui est une fuite passive : ici vous poussez le contenu d'un club dans la boîte de vos autres clients.

De plus, `notify_user` (`notify.py:16`) instancie `Notification(...)` **sans `club_id`** : toutes les notifications sont créées `club_id = NULL`.

### P0-2 est plus large que les parents — recensement

**27 modèles sur 35 ont un `club_id` nullable.** Combiné au filtre `or_(club_id == X, club_id IS NULL)` généralisé, chacun fuite vers tous les clubs dès qu'un seul site de création omet `club_id` :

`User`, `Category`, `Team`, `TeamCoach`, `Athlete`, `ParentChild`, `EmergencyContact`, `TeamMembership`, `Registration`, `Attachment`, `EventException`, `Convocation`, `Attendance`, `FeePlan`, `FeeInstallment`, `Payment`, `Receipt`, `CoachPayroll`, `MessageThread`, `Message`, `Notification`, `ParentNotificationPref`, `PushToken`, `InventoryAssignment`, `AuditLog`, `MediaObject`, `SystemFeedbackEvent`.

Seuls `Season`, `Discipline`, `Venue`, `Event`, `LedgerEntry`, `Announcement`, `InventoryItem` et `Document` sont en `club_id` NOT NULL.

Trois sites fautifs sont confirmés à ce stade : `User` via `club.py:1657/1789/2777`, `ParentChild` via `parents.py`, et `Notification` via `notify.py:16`. **Les 24 autres modèles n'ont pas été audités un par un** — c'est la tâche A2 de l'ordre de correctifs.

### P1-11 — Aucun endpoint pour suspendre ou supprimer un club

Vérifié : rien. Toute gestion de fin de contrat passe par du SQL en production. C'est aussi ce qui a empêché le nettoyage complet des clubs de test de cet audit (§7).

---

## 3. P1 — à régler avant de facturer

| # | Sujet | Détail |
|---|-------|--------|
| P1-1 | **Le rate-limit verrouille un club entier** | 10 requêtes / 5 min **par IP**, partagé entre login et inscription (`config.py:36-37`). Derrière le NAT d'un opérateur mobile algérien ou le wifi du club, le 11ᵉ parent qui se connecte est bloqué. Message trompeur en plus : l'inscription d'un club répond « Trop de tentatives de connexion ». À passer par compte, pas par IP. |
| P1-2 | **Aucune facturation, aucun contrôle d'essai** | `trial_ends_on` est écrit à l'onboarding mais **jamais relu**. J'ai créé 15 athlètes sur un plan `discovery` sans aucun blocage. Le champ `plan` n'est utilisé nulle part dans le code. Un essai ne se termine donc jamais. |
| P1-3 | **Saison « courante » globale** | `finance.py:92-94` fait `Season.is_current == True` **sans filtre club**. J'ai vérifié que plusieurs clubs ont simultanément `is_current=true` : un paiement rapide sans `season_id` explicite peut donc être rattaché à la saison d'un autre club (`finance.py:411`). Même motif dans `club.py:114`, `883-886`, et `mobile.py:36`. |
| P1-4 | **Impossible de supprimer un compte parent** | `DELETE /auth/users/{id}` répond « Seuls coach / staff peuvent être supprimés ici ». Aucun moyen d'effacer les données personnelles d'un parent depuis le produit. |
| P1-5 | **L'annuaire des clients est public** | `GET /club/list` renvoie **sans authentification** la liste de tous les clubs. Un prospect voit tous vos autres clients. |
| P1-6 | **Finance entièrement en français** | `FinancePage.tsx` (60 Ko) n'utilise pas `useI18n` — mois, onglets, tableaux en français en dur. Idem `TeamsPage` et `InventoryPage`. L'arabe est promis mais absent des modules de gestion. |
| P1-7 | **Pas de contrôle d'accès par route** | La navigation masque les modules selon le rôle, mais React Router ne bloque pas l'URL directe. Un parent peut ouvrir `/finance`. L'API protège, donc pas de fuite réelle, mais l'affichage est incohérent. |
| P1-8 | **Liens morts pour un visiteur** | `/download` et `/guide` sont sous l'authentification, alors que `LoginPage`, `InstallPage` et `PilotPage` y renvoient. Un parent qui veut l'APK depuis la page de connexion tombe sur le login. |
| P1-9 | **Endpoints de maintenance à portée globale** | `cleanup-tests`, `backfill-fees`, `prune-old-teams` agissent sur **toute la plateforme**, pas sur le club appelant, et sont accessibles à tout admin de club. Le garde-fou `?confirm=true` fonctionne et `ALLOW_TEST_CLEANUP=false` protège en prod, mais la portée reste à corriger. |
| P1-10 | **Pas de cotisation mensuelle automatique** | `ensure_season_fee_bundle` ne crée que « inscription » et « assurance ». Les échéances mensuelles sont à générer à la main. |

---

## 4. P2 — qualité et dette

- `club.py` fait **112 Ko** (3 083 lignes, 4 routeurs) et `finance.py` 44 Ko. Toute évolution multi-tenant y est risquée.
- Couverture de tests : **2 fichiers, 17 tests**. Rien sur les inscriptions, la finance, l'agenda.
- Le schéma de production est appliqué par `create_all` **plus** un `_ensure_schema()` de `ALTER TABLE` au démarrage avec des `except: pass` (`main.py:63-202`), en parallèle d'Alembic. Dérive de schéma difficile à auditer.
- `default_admin_password = "admin123"` en dur dans `config.py:21`.
- `Role.ADMIN` court-circuite toutes les vérifications de rôle (`deps.py:48-50`).
- Aucun module `logging`, aucun job de fond, aucun envoi d'email ou de SMS.
- Le dashboard finance renvoie `season_name: null` même pour WRBH.
- Les athlètes créés par l'API ressortent avec `list_number`, `age` et `category_name` à `null`.
- Bundle web de 953 Ko en un seul chunk.
- L'API Render (`wrbh-api.onrender.com`) est en timeout alors que le site Render reste en ligne et pointe vers elle : deux environnements dont un cassé. À décommissionner pour éviter qu'un prospect tombe dessus.
- `SPORT_LABELS` ne couvre que 9 sports, et `_SEASON_TEAM_STRUCTURE` contient une structure d'équipes spécifique à WRBH codée en dur (`club.py:864-873`).

---

## 5. Ce qui fonctionne bien

Pour être juste, voici ce que les tests ont validé :

- **Isolation des athlètes correcte.** Avec le jeton du club B sur un athlète du club A : `GET`, `PATCH` et `DELETE` renvoient tous `404`, sans divulguer l'existence de la ressource. Bon choix de conception.
- **Validations métier pertinentes.** Âge hors bornes : `400 « Âge hors plage club (5–17 ans). Né(e) 1990-01-01 → 36 ans. »`. Doublon : `409 « Joueur déjà existant … Doublon évité. »`. Catégorie incohérente : `400 « Année 2012 incompatible avec HAND-U17 (2009–2011). »`. Messages clairs et utilisables.
- **Onboarding fonctionnel.** Club + admin + saison + disciplines + 12 catégories d'âge créés en une requête, essai 14 jours positionné. 6 variantes de sports testées, 6 succès.
- **Agenda complet.** Création, approbation, démarrage, clôture de séance et feuille de présence : tout répond 200.
- **Sécurité d'accès saine.** Sans jeton : 401. Jeton forgé : 401. Média d'un autre club : 404. OpenAPI désactivé en production. Mots de passe en bcrypt.
- **Performances correctes.** Tous les endboints testés répondent en moins de 0,3 s.
- **Tarification réelle.** 20 000 DZD/an, installation 35 000 DZD — des montants concrets, pas des placeholders.

---

## 6. Plan et délai

Estimations pour un développeur à plein temps.

### Palier 1 — Remettre le produit en marche (2 à 3 jours)

1. Commiter et déployer le correctif `parents.py` — **P0-1**
2. Passer `club_id` aux 3 appels manquants + rattacher les lignes NULL — **P0-2**
3. Capturer l'`IntegrityError` de l'onboarding → 409 lisible — **P0-5**
4. Ajouter un test d'intégration du parcours inscription complet
5. Purger les données `ZZTEST` (§7)

À l'issue : le produit refonctionne et une démo est possible.

### Palier 2 — Rendre la vente défendable (1 semaine)

6. Domaine + HTTPS + redirection HTTP→HTTPS — **P0-3**
7. Sauvegarde automatique quotidienne + copie hors-site + **test de restauration** — **P0-4**
8. Rate-limit par compte au lieu de par IP — **P1-1**
9. `GET /club/list` authentifié ou supprimé — **P1-5**
10. Rendre `/download` et `/guide` publics — **P1-8**
11. Décommissionner l'environnement Render

À l'issue : **pilote payant possible** sur 2 à 3 clubs, facturation manuelle.

### Palier 3 — Crédibilité SaaS (2 à 3 semaines)

12. Saison courante filtrée par club partout — **P1-3**
13. Contrôle de l'essai : blocage ou bandeau à l'expiration — **P1-2**
14. Unicité `(club_id, phone)` et `(club_id, email)` — **P0-5** de fond
15. Suppression de compte parent — **P1-4**
16. Traduire Finance, Équipes, Matériel en arabe — **P1-6**
17. Contrôle d'accès par route côté web — **P1-7**
18. Cadrer les endpoints de maintenance sur le club appelant — **P1-9**
19. Échéances mensuelles automatiques — **P1-10**

### Palier 4 — Self-serve (4 à 6 semaines)

20. Facturation récurrente (sachant que Stripe n'opère pas en Algérie — à cadrer : CIB/Edahabia, virement, espèces)
21. Console super-admin multi-clubs (`is_superadmin` existe mais n'est utilisé nulle part)
22. Quotas par plan
23. Sous-domaine ou branding par club
24. Découpage de `club.py` et couverture de tests

### Synthèse des délais

| Objectif | Délai |
|----------|-------|
| Démo possible | **2 à 3 jours** |
| Premier client pilote payant | **~2 semaines** |
| SaaS multi-clubs crédible | **6 à 8 semaines** |
| Self-serve complet | **3 mois** |

---

## 7. Nettoyage des données de test — action requise

Les athlètes, inscriptions et événements `ZZTEST` sont **supprimés**. Deux catégories n'ont pas pu l'être, faute d'endpoint API et d'accès SSH depuis mon poste :

- **5 comptes parents `club_id = NULL`** (ids 165 à 169) — encore visibles dans la liste des comptes de WRBH
- **8 clubs de test** encore dans l'annuaire public : `zztest-4660`, `zztest-phone-67930`, `zztest-probe-02606`, `zztest-probe-16819`, `zztest-probe-25458`, `zztest-probe-37631`, `zztest-probe-72155`, `zztest-probe-85908`
- **2 comptes admin de test** (ids 155 et 163)

À exécuter sur le VPS :

```bash
docker exec -it wrbh-db psql -U wrbh -d wrbh
```

```sql
BEGIN;
-- Comptes parents de test (club_id NULL)
DELETE FROM parent_children WHERE parent_id IN (165,166,167,168,169);
DELETE FROM notifications   WHERE user_id   IN (165,166,167,168,169);
DELETE FROM users           WHERE id        IN (165,166,167,168,169);

-- Clubs de test et tout leur contenu
CREATE TEMP TABLE zz AS SELECT id FROM clubs WHERE slug LIKE 'zztest%';
DELETE FROM categories  WHERE club_id IN (SELECT id FROM zz);
DELETE FROM disciplines WHERE club_id IN (SELECT id FROM zz);
DELETE FROM seasons     WHERE club_id IN (SELECT id FROM zz);
DELETE FROM audit_logs  WHERE club_id IN (SELECT id FROM zz);
DELETE FROM users       WHERE club_id IN (SELECT id FROM zz);
DELETE FROM clubs       WHERE id      IN (SELECT id FROM zz);

-- Vérification : doit renvoyer 0
SELECT count(*) FROM clubs WHERE slug LIKE 'zztest%';
SELECT count(*) FROM users WHERE full_name LIKE 'ZZTEST%';
COMMIT;
```

Faites un `backup_db.sh` **avant**, et adaptez les noms de tables aux `__tablename__` réels si besoin.

Les scripts de sonde utilisés pendant l'audit ont été supprimés après usage, ainsi que les fichiers de jetons JWT qu'ils mettaient en cache (ils contenaient un jeton admin WRBH valide 12 h). Un garde-fou a été ajouté dans `.gitignore` (`backend/scripts/_audit_tokens*.json`).

Ce qui reste de l'audit dans le dépôt, volontairement :

- `docs/AUDIT_COMMERCIALISATION_2026-10-01.md` — ce rapport
- `backend/tests/test_registration_flow.py` — 3 tests verrouillant le parcours inscription. Deux passent grâce au correctif local de `parents.py` (ce qui **confirme** que le déployer résout P0-1). Le troisième est marqué `xfail(strict=True)` et documente P0-2 : retirez le marqueur en même temps que le correctif, le test deviendra vert. Suite complète : **19 passés, 1 xfailed**.

---

## 8. Avis d'expert sport

Sur le fond métier, le produit est bien pensé pour le marché algérien : catégories U7→U17 générées par sport, tranches d'âge cohérentes avec les fédérations, assurance annuelle séparée de la cotisation mensuelle, droits d'inscription distincts, kit maillot/sac avec taille, suivi parental des séances, DZD et bilingue FR/AR. Un gérant de club y retrouve son vocabulaire.

Trois manques que les clubs vous demanderont vite :

1. **Licences et affiliation fédérale** — numéro de licence, date de validité, alerte d'expiration, export au format de la fédération. C'est l'obligation administrative n°1 d'un club algérien et c'est aujourd'hui réduit à un champ `license_number` libre.
2. **Certificat médical** — aucune gestion de date de visite ni d'alerte d'expiration. C'est une responsabilité juridique directe du club en cas d'accident.
3. **Résultats et compétitions** — l'agenda gère les matchs avec score, mais il n'y a ni classement, ni statistiques joueur, ni historique de compétition. Un club de handball ou de football le demandera en première réunion.

Aucun des trois n'est bloquant pour vendre. Je les placerais en roadmap post-pilote, après avoir écouté les deux premiers clients.

---

## 9. Réponse directe

> *Est-ce que le système est prêt à être commercialisé ?*

**Pas aujourd'hui** — la fonction d'inscription est en panne en production.

**Dans 2 à 3 jours**, après le correctif `parents.py`, le cloisonnement des comptes parents et la purge des données de test : vous pouvez faire des démos.

**Dans environ 2 semaines**, avec HTTPS, un domaine et des sauvegardes automatiques : vous pouvez signer un premier club payant en vente assistée.

**Dans 6 à 8 semaines** : plusieurs clubs en parallèle sans risque de fuite de données.

Le produit n'est pas loin. Ce qui bloque n'est pas un manque de fonctionnalités — c'est un commit incohérent, une règle de cloisonnement oubliée à trois endroits, et de l'hébergement à finir. Le travail métier, lui, est largement fait.

---

## 10. Impact Android

Tous les points P0 touchent l'app de la même façon, car elle consomme la même API :

- **P0-1** : l'inscription depuis l'app Android est **également en panne** (`POST /api/v1/registrations`). Rien à changer côté app — le correctif backend suffit.
- **P0-2** : une fois les parents cloisonnés, vérifier que `GET /api/v1/children` et l'écran parent ne renvoient que les enfants du club courant.
- **P0-3** : après la mise en place du domaine HTTPS, mettre à jour `mobile/app.json` (`apiUrl` en `https://…`) et **retirer** `usesCleartextTraffic`, prérequis pour une publication Play Store.
- **P0-5** : adapter le message d'erreur de `mobile/app/onboard.tsx` au futur 409.
- **P1-1** : le rate-limit par IP est encore plus pénalisant sur mobile (NAT opérateur) — à traiter avant de pousser l'app aux parents.
