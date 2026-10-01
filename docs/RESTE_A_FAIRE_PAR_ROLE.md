# Reste à faire — répartition par développeur

**Édité le :** 2026-10-01, 13h35
**Échéance :** FormaTech Expo, **12–15 octobre 2026**, SAFEX Pavillon A, Alger
**Méthode :** état **vérifié dans le code et en production**, pas déclaratif. Chaque ligne a été contrôlée.

**Documents de référence :**
- Constats : `docs/AUDIT_COMMERCIALISATION_2026-10-01.md`
- Ordre backend / web : `docs/ORDRE_CORRECTIFS_PRE_SALON.md`
- Ordre Android : `docs/ORDRE_DEV_APP_ANDROID.md` §9

---

## 0. Tableau de bord — où en est-on

### Terminé et vérifié

| Réf | Tâche | Preuve |
|-----|-------|--------|
| A1 | Inscription réparée | `POST /registrations` → **200** testé en production |
| A2 | Parents cloisonnés | Les 4 appels passent `club_id` ; parent créé avec `club_id=2` ; **0** compte `club_id=NULL` |
| A4 | Onboarding → 409 | Testé en prod : `409 "Téléphone admin déjà utilisé"` |
| A5 | Données de test purgées | `/club/list` ne renvoie plus que `wrbh` et `demo-judo-978` |
| A7 | Suspension de club | Implémenté dans `tenant.py` (écriture 403, lecture OK) — **non commité** |
| A8 | `notify_role` scopé | Implémenté ; l'appelant unique passe `club_id` — **non commité** |
| B5 | `/download` et `/guide` publics | `web/src/App.tsx:47-48` |
| — | Tests | **21 passent**, couverture **43 %**, marqueur `xfail` retiré |
| — | App mobile 429 / 500 / 409 | `mobile/src/api/client.ts:25-45` |

### Bloquant immédiat

**A10 — fait (2026-10-01).** Commit `7b46f2d` poussé + redéploiement depuis git. `/health` expose `version=1.18.0` et `git_sha`. Règle permanente : plus aucun déploiement depuis une copie de travail.

---

## 1. Développeur système / SaaS (backend)

### P0 — avant le salon

| Réf | Tâche | Détail |
|-----|-------|--------|
| **A10** | **Commiter et redéployer depuis git** | Commiter `auth.py`, `club.py`, `finance.py`, `tenant.py`, `schemas/__init__.py`, `notify.py`. Incrémenter la version (toujours `1.17.0` alors que le code a changé). Exposer le **SHA du commit** dans `/health`. Règle permanente : plus aucun déploiement depuis une copie de travail. |
| **A3** | **`club_id` NOT NULL sur 27 modèles** | **27 modèles sur 35** ont un `club_id` nullable, et il reste **63 occurrences** de `club_id.is_(None)` dans `api/` et `services/`. Tant que ce filtre existe, toute ligne créée sans `club_id` fuite vers tous les clients. Migration Alembic + filtres stricts + retirer la tolérance de `tenant.py:74`. Prendre `agenda.py:112` comme modèle de référence. |
| **A6** | **Tester les parcours critiques** | La couverture globale de 43 % est trompeuse : `finance.py` est à **16 %** (477 lignes non testées), `club.py` 24 %, `agenda.py` 23 %, `auth.py` 28 %. **`finance.py` à 16 % est le module qui manipule l'argent.** Couvrir : paiement → reçu → tableau de bord ; changement de constantes de cotisation ; cycle de séance ; notification à deux clubs ; club suspendu ; upload inter-clubs. |
| **B1** | **Domaine + HTTPS** (part backend) | Reverse proxy TLS (Caddy recommandé), `api.<domaine>` → 8081, mettre à jour `CORS_ORIGINS`. **Lancer l'achat du domaine aujourd'hui** : la propagation DNS est le chemin critique. |
| **B2** | **Sauvegarde automatique + restauration testée** | `backup_db.sh` est manuel, aucun cron, dumps sur le même serveur. Cron quotidien + copie hors-site + **une restauration réellement effectuée**. Mesurer la taille du dump : les photos sont en base (2 Mo max/athlète). |
| **B3** | **Rate-limit par compte** | `config.py:36-37` : 10 requêtes / 5 min **par IP**, partagé login + onboarding. Derrière le wifi du salon (IP unique) **vous vous bloquerez vous-même en démo**. |
| **B4** | **Fermer `GET /club/list`** | Expose sans authentification la liste de tous vos clients. |
| **C5** | **Rendre l'essai réel** (part backend) | `trial_ends_on` est écrit mais jamais relu ; `plan` n'est utilisé nulle part. Bloquer l'écriture à l'expiration, laisser lecture et export. |
| **C2** | **Schéma licence + certificat médical** | `license_number`, `license_valid_until`, `license_status`, `medical_cert_date`, `medical_cert_valid_until` + endpoint de filtre « à renouveler ». **À livrer tôt : le web et l'Android en dépendent.** |
| **C1** | **Script de seed de démo** | `backend/scripts/seed_demo.py` idempotent, 3 clubs remplis, rejouable pour réinitialiser entre deux visiteurs. |
| — | **Supprimer le compte résiduel** | Compte parent `VERIFYFIX…` (**id 171**) laissé par ma vérification dans le club de démo `demo-judo-978` — c'est votre vitrine du salon. Suppression SQL (l'API ne permet pas de supprimer un parent, voir D3). |

### P1 — après le salon

| Réf | Tâche |
|-----|-------|
| A9 | Endpoints super-admin : suspendre / réactiver / supprimer un club. Aujourd'hui **aucun** n'existe : tout churn passe par du SQL en production. |
| D1 | `_current_season_id` (`finance.py:92-94`) : saison courante **globale**, sans filtre club. Idem `club.py:114`, `883-886`, `mobile.py:36`. Un paiement rapide sans `season_id` peut tomber dans la saison d'un autre club. |
| D2 | `cleanup-tests`, `backfill-fees`, `prune-old-teams`, `cleanup-audit` agissent sur **toute la plateforme**. |
| D3 | Impossible de supprimer un compte parent — exigence loi 18-07 (droit d'opposition, amende 500 000 DA). |
| D6 | `uploads.py:45-47` et `59-61` : un staff contourne le contrôle de tenant et peut lire n'importe quel média. |
| D7 | `default_admin_password = "admin123"` en dur (`config.py:21`). |
| D8 | `Role.ADMIN` court-circuite tous les contrôles de rôle (`deps.py:48-50`). |
| D9 | Échéances mensuelles non générées automatiquement (`fees.py:303-306`). |
| D10 | `_resolve_club_id` (`fees.py:52-56`) retombe sur WRBH : un club sans `club_id` hérite de ses tarifs. |
| D11 | Mot de passe admin d'onboarding moins contrôlé que `change-password`. |
| D12 | JWT 12 h sans révocation ni refresh ; `.env.example` annonce 7 jours (incohérence). Lié à A7. |
| D13 | Aucune journalisation applicative (`logging` absent) — indispensable pour dépanner 40 clubs. |
| D15 | `GET /exports/export` renvoie 404 — à diagnostiquer. |
| D16 | Pagination absente sur `inventory/items`, équipes, disciplines. |
| — | Chargily Pay (CIB / EDAHABIA, SDK Python officiel) pour la facturation. **Pas avant le salon.** |
| — | Découper `club.py` (112 Ko) et `finance.py` (44 Ko) ; photos hors base ; Redis ; multi-worker. |
| — | `notify_user` est appelé sans `club_id` dans `parental.py` (90, 155, 200, 212). Correct grâce au repli, mais une requête par notification alors que `event.club_id` est disponible ligne 190. |

---

## 2. Développeur web

### P0 — avant le salon

| Réf | Tâche | Détail |
|-----|-------|--------|
| **C3** | **Arabe sur les modules de gestion** | Vérifié : `FinancePage.tsx` (60 Ko), `TeamsPage.tsx` et `InventoryPage.tsx` ont **0 occurrence de `useI18n`** — tout est en français en dur (mois, onglets, tableaux, messages). `AthletesPage` et `DashboardPage` sont faits. Sur un salon à Alger, une partie des visiteurs demandera la démo en arabe. **Priorité : Finance d'abord**, puis Équipes, puis Matériel. Vérifier le RTL. |
| **C2** | **Interface licence + certificat médical** | Saisie sur la fiche athlète, pastille « expire dans moins de 30 jours » dans la liste, filtre « à renouveler », une ligne au tableau de bord. **Dépend du schéma backend.** |
| **C5** | **Bandeau d'essai** | Vérifié : **aucune** mention de `trial` dans `AppLayout.tsx`. Ajouter « essai — J-n » et un message clair à l'expiration (le backend bloquera l'écriture). |
| **C4** | **Console super-admin en lecture seule** | N'existe pas. Liste des clubs + plan + fin d'essai + nombre d'athlètes. Indispensable pour défendre le discours « plateforme multi-clubs ». **4 h maximum, pas d'édition.** |
| **D17** | **Slug de démo codé en dur** | `PilotPage.tsx:73` pointe vers `demo-judo-978`. Si ce club est renommé ou supprimé, le bouton « Voir la démo live » casse en pleine démonstration. À rendre configurable. |
| **B6** | **Décommissionner Render** | `wrbh-api.onrender.com` est en timeout mais `wrbh-web.onrender.com` répond encore et pointe vers cette API morte. Un visiteur qui tombe dessus voit un produit cassé. Supprimer ou rediriger. |

### P1 — après le salon

| Réf | Tâche |
|-----|-------|
| D4 | Pas de contrôle d'accès par route : la navigation masque les modules par rôle, mais un parent peut ouvrir `/finance` directement. L'API protège, donc pas de fuite — mais c'est incohérent en démo. |
| D14 | `InventoryPage.tsx:54-56` avale les erreurs d'API (`.catch(() => [])`) : l'utilisateur voit une liste vide au lieu d'un message. À auditer sur les autres pages. |
| — | Bundle de 953 Ko en un seul chunk — découpage à prévoir. |
| — | `web/package.json` en version `1.0.0` alors que l'app est en 1.8.0. |
| — | Route `/welcome` qui double la landing ; alias `/offre` et `/pilot` sans lien. |

---

## 3. Développeur application Android

Détail complet dans `docs/ORDRE_DEV_APP_ANDROID.md` §9. État vérifié dans le code.

### Déjà fait

Messages 429 / 500 / 409 (`client.ts:25-45`), déconnexion sur 401, mise à jour automatique de l'APK (`UpdateGate`), `ErrorBoundary`, login multi-club avec slug, écran d'onboarding, version 1.8.0 / versionCode 11.

### P0 — avant le salon

| Réf | Tâche | Détail |
|-----|-------|--------|
| **C8** | **Démo hors ligne** | Le wifi SAFEX n'est pas fiable. L'APK doit pouvoir pointer vers un backend **local** (portable en point d'accès). Vérifier si `extra.apiUrl` est surchargeable à l'exécution ; sinon produire un APK de démo dédié. **C'est le filet de sécurité du stand.** |
| **C12** | **Gérer le code 403** | Vérifié : `403` **n'est géré nulle part** dans `mobile/src`. `client.ts` traite `401` et `429` seulement. Or le backend renvoie désormais `403` pour : club suspendu en écriture, utilisateur sans club, rôle insuffisant. Sans traitement, l'utilisateur voit une erreur brute. |
| **C9** | **Écran « club suspendu »** | Dépend de C12. Bandeau « abonnement suspendu — lecture seule », masquer les boutons de création. Le backend autorise lecture et export. |
| **C2** | **HTTPS** | Vérifié : `app.json:74` est toujours en `http://46.224.38.201:8081` et `app.json:27` a `usesCleartextTraffic: true`. **Bloqué par B1.** Dès que le domaine est prêt : `https://`, retirer le cleartext, rebuild, republier. **Prérequis Play Store.** |
| **C10 / C3** | **Revalider le cloisonnement** | Vérifier que l'onglet notifications ne montre que le club courant, et que `GET /children` / `GET /mobile/home` ne renvoient que les enfants du club. |
| **C11** | **i18n — début** | Voir ci-dessous. **Avant le salon, viser uniquement Accueil et Agenda en arabe** — les deux écrans montrés en démonstration. |

### Le gros manque Android : aucune internationalisation

Résultat de la vérification dans `mobile/` :

| Contrôle | Résultat |
|----------|----------|
| `useI18n`, `i18n`, `locale ===` | **0 occurrence** |
| `I18nManager`, gestion RTL | **absents** |
| Chaînes arabes | **44 lignes codées en dur** dans 10 fichiers (ex. `"Connexion / دخول"`) |
| Bascule de langue | **aucune** |

Le web a un dictionnaire FR/AR complet (`web/src/i18n.tsx`, ~70 clés) avec bascule et RTL. **L'app, elle, est en pratique francophone.** Vous vendez un produit bilingue à un marché où beaucoup de parents sont arabophones : c'est le décalage le plus visible entre la promesse et le produit.

**À faire (ne rentre pas en entier avant le 12 octobre) :** porter `web/src/i18n.tsx` en contexte React Native, bascule de langue dans Profil, `I18nManager.forceRTL` pour l'arabe, puis migrer dans cet ordre : Accueil → Agenda → Inscriptions → Athlètes → Paiements.

### P1 — après le salon

| Réf | Tâche |
|-----|-------|
| C11 | Terminer l'i18n sur tous les écrans + RTL complet |
| C7 | Licence fédérale + certificat médical (après schéma backend) |
| C6 | Écran Guide / formation — `/guide` est désormais une **route publique**, une `WebView` suffirait |
| C6 | Administration des feedbacks (le web a `FeedbackAdminPage`, l'app n'a que la soumission) |
| — | Parité tableau de bord : l'accueil mobile est une version simplifiée, sans les graphiques du web |
| — | Publication Play Store (bloquée par C2 : cleartext interdit) |

---

## 4. Dépendances entre les trois développeurs

Ces enchaînements déterminent l'ordre de travail. Un retard sur la gauche bloque la droite.

```
A10 (commit + redéploiement)  ──> débloque TOUT le reste
         │
B1 domaine + TLS (backend) ───┬──> C2 Android : https + retrait cleartext
                              └──> PWA web fonctionnelle (service worker)
         │
C2 schéma licence (backend) ──┬──> C2 web : interface licence
                              └──> C7 Android : miroir fiche athlète
         │
C5 essai (backend) ───────────┬──> C5 web : bandeau « essai J-n »
                              └──> (app : rien avant le salon)
         │
A7 suspension (backend, fait) ┬──> C12 + C9 Android : gérer 403
                              └──> D4 web : cohérence d'affichage
         │
C1 seed démo (backend) ───────────> dispositif de stand (C8 Android)
```

**Trois points de synchronisation obligatoires :**

1. **Aujourd'hui** — le backend fait A10. Les deux autres développeurs **attendent** : travailler sur une base dont la production diverge de git revient à coder à l'aveugle.
2. **Achat du domaine aujourd'hui** — la propagation DNS est le chemin critique de B1, et B1 bloque la PWA web **et** l'APK Android. C'est la décision la plus urgente de la journée.
3. **Schéma licence livré tôt** (J5 au plus tard) — deux développeurs en dépendent.

---

## 5. Ce qu'il ne faut pas faire avant le 12 octobre

Pour éviter d'arriver au salon avec un produit à nouveau cassé :

- Paiement en ligne et facturation récurrente (Chargily) — vous collectez des contacts au salon, pas des paiements
- Quotas détaillés par plan
- Sous-domaine par club
- Export au format fédération — à cadrer **après** avoir écouté les deux premiers clients
- Découpage de `club.py` et `finance.py`
- Migration des photos hors base, Redis, multi-worker
- Publication Play Store
- i18n Android complète (seulement Accueil et Agenda)
- Toute fonctionnalité non listée dans les ordres

---

## 6. Hors développement, à lancer aujourd'hui

| Action | Pourquoi |
|--------|----------|
| **Déclaration ANPDP** (`anpdp.dz`) | Loi 18-07 art. 12 : déclaration préalable obligatoire, récépissé sous 48 h. Vous traitez des données de **mineurs** (noms, dates de naissance, groupe sanguin, photos, téléphones parents). Délai de conformité expiré depuis août 2023. Les ministères sont partenaires du salon — le récépissé est un argument de vente. |
| **Achat du domaine** | Chemin critique de B1, qui bloque la PWA web et l'APK Android. |
| **Case de consentement exprès** | Vos serveurs sont en Allemagne (Hetzner). Le transfert hors d'Algérie relève de l'autorisation préalable, avec le consentement exprès comme exception (art. 45). |
| **Politique de confidentialité** publiée | Corollaire de la déclaration. |
| **Réponse préparée sur l'hébergement** | Votre concurrent algérien **Almawarid** (Oran) vend « données en Algérie + conforme 18-07 + CIB/Edahabia ». Ne pas improviser : formulation proposée en §6.2 de `ORDRE_CORRECTIFS_PRE_SALON.md`. |
| **Dispositif de stand** | Deux appareils (portable admin + téléphone parent), démo hors ligne, réinitialisation entre visiteurs, QR de capture de contacts, **gel du code le 10 octobre**. |
