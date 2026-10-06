# Matrice rôles & accès — exhaustif

**Complément de :** `ORDRE_LOGICIEL_MAITRE.md`  
**Codes :** `admin` · `direction` · `staff` · `coach` · `parent`  
Légende : **C** = consulter · **É** = écrire / créer · **M** = modifier · **S** = supprimer / archiver · **R** = restaurer (corbeille) · **—** = interdit

---

## 1. Identité & session

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Connexion email/téléphone | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voir son profil / changer MDP | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bootstrap club + rôle | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 2. Tableau de bord

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| KPI club + graphes analytics | C | C | C | C | — |
| Accueil enfants / séances / notifs | — | — | — | — | C |
| Segments période / filtres | C | C | C | C | — |

---

## 3. Athlètes

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Liste / recherche / fiche | C | C | C | C* | — (via « mes enfants ») |
| Créer athlète | É | É | É | É* | — |
| Modifier fiche | M | M | M | M* | — |
| Archiver / supprimer | S | S | — | — | — |
| Restaurer | R | R | R | — | — |

\* Coach : limité aux athlètes de ses équipes (règle API).

---

## 4. Inscriptions

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Liste inscriptions | C | C | C | — | C (siennes) |
| Créer inscription | É | É | É | — | É |
| Valider / rejeter / archiver | S | S | S | — | — |
| File offline (sync) | ✓ | ✓ | ✓ | — | ✓ |
| Photos / kit | É | É | É | — | É |

---

## 5. Agenda / séances

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Voir calendrier / liste | C | C | C | C | C (enfants) |
| Créer / modifier séance | É/M | É/M | É/M | É/M | — |
| Champ lieu | É | É | É | É | C |
| Case notifier parents | É | É | É | É | — |
| Approuver / rejeter | ✓ | ✓ | ✓ | — | — |
| Démarrer / terminer | ✓ | ✓ | ✓ | ✓ | — |
| Pointage présence | ✓ | ✓ | ✓ | ✓ | C (notif) |
| Annuler + notifier | ✓ | ✓ | ✓ | ✓ | — |
| RSVP convocation | — | — | — | — | ✓ |
| Préférences notifications | — | — | — | — | É |
| Job rappels (manuel) | ✓ | — | — | — | — |

---

## 6. Équipes & coachs

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Liste équipes | C | C | C | C | — |
| Créer / modifier équipe | É/M | É/M | É/M | — | — |
| Assigner coach | É | É | É | — | — |
| Voir effectif | C | C | C | C | — |
| Archiver équipe / lien coach | S | S | — | — | — |

`direction` ∈ `TEAM_COACH_ROLES` : peut être coach d’une équipe.

---

## 7. Comptes utilisateurs

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Accéder page Comptes | ✓ | ✓ | — | — | — |
| Créer admin | ✓ | — | — | — | — |
| Créer direction / staff / coach / parent | ✓ | ✓ | — | — | — |
| Activer / désactiver | ✓ | ✓ | — | — | — |
| Reset mot de passe | ✓ | ✓ | — | — | — |
| Consulter aide matrice rôles | C | C | — | — | — |

---

## 8. Finance

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Page Finance + KPI | C | C | C | — | — |
| Cotisations (créer / éditer) | É | É | É | — | C (ses) |
| Paiements | É | É | É | — | — |
| Achats / recettes / dépenses | É | É | É | — | — |
| Paie coachs | É | É | —* | — | — |
| Graphes + plein écran | C | C | C | — | — |
| Export | ✓ | ✓ | ✓ | — | — |

\* Selon API `finance.py` / rôles exacts — ne jamais élargir coach/parent.

---

## 9. Matériel

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Inventaire | C/É | C/É | C/É | — | — |
| Attributions | É | É | É | C* | — |

---

## 10. Annonces & communication

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Lire annonces | C | C | C | C | C |
| Créer / publier | É | É | É | —* | — |
| Notifications in-app | C | C | C | C | C |
| Marquer lu | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Coach : lecture ; création selon policy club (par défaut non).

---

## 11. Feedback

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Envoyer feedback | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin liste feedbacks | C | C | — | — | — |

---

## 12. Historique / Corbeille

| Fonction | admin | direction | staff | coach | parent |
|----------|:-----:|:---------:|:-----:|:-----:|:------:|
| Consulter journal | C | C | C | — | — |
| Restaurer athlète / inscription / ledger / user | R | R | R | — | — |
| Purge définitive | — (non exposé) | — | — | — | — |

**Règle métier :** une « suppression » utilisateur archive / soft-delete. La **corbeille** = actions restaurables dans Historique. Qui peut **voir** la corbeille = admin + direction + staff. Qui peut **restaurer** = idem (pas coach, pas parent).

---

## 13. Paramètres club (limites équipe)

| Paramètre | Qui configure | Effet |
|-----------|---------------|-------|
| `parental_require_coach_approval` | admin / direction | Séances coach → `pending_approval` |
| `parental_auto_approve_coach` | admin / direction | Auto-approve séances coach |
| Sports / saisons / tarifs | admin / direction / staff | Cadre inscriptions & agenda |

**Limites parent (non négociables) :**
- Pas de création / édition séance  
- Pas de pointage  
- Pas de finance club globale  
- Pas de comptes utilisateurs  
- Pas de corbeille  
- Voir uniquement **ses** enfants et séances liées  

---

## 14. App Android — mêmes règles

Tout bouton mobile doit respecter cette matrice. Si un rôle n’a pas le droit site → **ne pas** afficher le bouton app (pas d’erreur 403 surprise).

---

## 15. Super-admin plateforme (`superadmin`)

Hors matrice club. Compte `club_id = NULL`. Accès exclusif :

| Fonction | API | Droit |
|----------|-----|-------|
| Dashboard multi-clubs | `GET /api/v1/admin/dashboard` | C |
| Liste / suspension / plan clubs | `GET/PATCH /api/v1/admin/clubs` | C / M |
| Liste comptes + présence | `GET /api/v1/admin/users` | C |
| Activer / désactiver compte | `PATCH /api/v1/admin/users/{id}` | M |
| Écran web `/platform` + app `platform` | — | ✓ |

Aucun rôle club (`admin` … `parent`) ne peut appeler ces routes (403).

---

## 16. Interfaces web par rôle (2026-10-05)

| Rôle | Accueil (`/`) | Menu visible | Faisable / Affichable |
|------|---------------|--------------|------------------------|
| **parent** | `ParentHomePage` | Accueil, Inscriptions, Agenda, Annonces, Guide, App | Voir enfants / séances / notifs ; RSVP ; inscriptions siennes — **pas** pointage, finance club, comptes |
| **coach** | `CoachHomePage` | Accueil, Athlètes, Agenda, Équipes, Annonces… | Séances + présences de ses équipes — **pas** Finance, Comptes, Corbeille, publier annonces |
| **staff** | Dashboard analytics | Ops sans Comptes / Feedback admin | Inscriptions, agenda, finance ops, matériel |
| **direction** | Dashboard analytics | + Comptes + Feedback | Pilotage + validation séances |
| **admin** | Dashboard analytics | Complet club | Admin club (hors plateforme) |
| **superadmin** | + `/platform` | Plateforme | Multi-clubs |

Code source : `web/src/roles/access.ts`.

---

*Mettre à jour ce fichier dès qu’un bouton ou endpoint change de droit.*
