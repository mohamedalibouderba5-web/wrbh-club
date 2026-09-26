# ORDRE DÉVELOPPEURS — Suivi parental & cycle de vie des séances

**Priorité :** critique (produit différenciant + salon)  
**Cible :** site web + application Android  
**Références marché :** TeamSnap, Heja, SportsEngine (rappels, présence, notifications push, préférences parent)

---

## 1. Objectif produit

Mettre en place un **système de suivi parental de niveau international** pour clubs sportifs (tous sports Algérie) :

- Le parent suit son enfant (athlète) en temps réel via **notifications** (app en priorité).
- Coach / admin gèrent **création → validation → démarrage → pointage → fin** de séance.
- Sécurité enfant + tranquillité parent = argument marketing, **dans un cadre de gestion de club**.

---

## 2. Benchmarks à respecter (normes UX)

| Capacité | TeamSnap / Heja | Notre cible |
|----------|-----------------|-------------|
| Notif création / modification / annulation | Oui | Oui |
| Rappels configurables (ex. 1 h / 1 j avant) | Oui | Oui (préférences parent) |
| Présence / absence / retard → info famille | Oui | Oui |
| Lieu / horaire clairs | Oui | Oui (`location_text` + horaire) |
| Contrôle admin sur « qui est notifié » | Partiel | Oui (`notify_parents`) |
| Validation coach → admin | Rare | Oui (auto ou manuel) |
| Début / fin de séance | Rare | Oui (cycle de vie explicite) |

Sports : modèle **générique** (training / match / meeting / camp / other) — football d’abord, même flux handball, judo, etc.

---

## 3. Flux métier (à implémenter / maintenir)

```
Coach ou Admin crée séance
        │
        ├─ Admin / Direction / Staff → statut approved (si notify_parents → notif parents)
        └─ Coach + club exige validation → pending_approval
                │
                Admin approuve / rejette
                │
                approved + notify_parents → notif « nouvelle séance » (lieu, date, type)
        │
Parents : rappels selon préférences (1 h / 1 j) — job cron `GET/POST /api/v1/jobs/parental-reminders`
        │
Coach : « Démarrer séance » → session_status=in_progress → notif parents (option)
        │
Coach : pointage present / absent / late → notif parent de l’athlète
        │
Coach : « Terminer séance » → completed → notif parents (séance terminée)
        │
Annulation → notif si demandé
```

---

## 4. Contrats API (backend)

### Séances (`/api/v1/events`)
- `POST /events` — champs : `notify_parents`, `location_text`, `approval_status` (calculé)
- `POST /events/{id}/approve` — admin
- `POST /events/{id}/reject` — admin
- `POST /events/{id}/start` — coach/admin → début + notifs
- `POST /events/{id}/complete` — fin + notifs
- `POST /events/{id}/attendance` — **notifie** le parent à chaque changement de statut
- `POST /events/{id}/cancel` — déjà existant + notify

### Préférences parent
- `GET /api/v1/parent/notification-prefs`
- `PUT /api/v1/parent/notification-prefs`  
  Champs : `notify_on_create`, `notify_on_start`, `notify_on_end`, `notify_on_attendance`, `notify_on_cancel`, `remind_minutes_before` (ex. 60), `remind_day_before` (bool)

### Club (settings)
- `parental_require_coach_approval` = `true|false` (ClubSetting)
- `parental_auto_approve_coach` = `true|false`

### Job rappels
- `POST /api/v1/jobs/parental-reminders` (protégé admin / cron secret) — envoie les rappels dus

---

## 5. Ordre UI — Application Android (PRIORITÉ PARENTS)

1. **Écran Préférences notifications** (profil parent)  
   - Toggles create / start / end / attendance / cancel  
   - Rappel : 15 min / 1 h / 3 h / veille  
2. **Agenda parent** — badges : planifiée / en cours / terminée / annulée ; lieu visible  
3. **Messages → Notifications** — liste déjà existante : s’assurer kinds `session_create`, `session_start`, `session_end`, `attendance`, `cancel`, `reminder`  
4. **Push Expo** — brancher `PushToken` + envoi FCM/Expo quand notif créée (phase 2 si pas déjà)  
5. **Agenda coach** — boutons Démarrer / Terminer / Pointage (couleurs claires) ; créer séance avec case « Informer les parents » + lieu

---

## 6. Ordre UI — Site web

1. **Agenda** — mêmes actions start/complete/approve + case notify + lieu  
2. **Direction** — file « Séances en attente de validation »  
3. **Paramètres club** (ou ClubSetting) — validation coach auto/manuel

---

## 7. Critères d’acceptation (salon / démo)

- [ ] Créer entraînement → parent voit notif (app + liste) avec date/lieu  
- [ ] Parent règle rappel 1 h → job envoie rappel  
- [ ] Coach démarre → parent « séance en cours »  
- [ ] Absent → parent « votre enfant est signalé absent »  
- [ ] Fin → parent « séance terminée »  
- [ ] Annulation → parent informé  
- [ ] Coach crée + club en mode validation → pas de notif parents tant que non approuvé  
- [ ] Fonctionne pour types training **et** match (multi-sport ready)

---

## 8. Phases

| Phase | Contenu | Statut cible |
|-------|---------|--------------|
| **P1** | Modèle + API cycle de vie + notifs in-app + prefs + UI web/mobile de base | **En cours / livré cœur** |
| **P2** | Push Expo/FCM réel + cron rappels serveur | Suivre |
| **P3** | RSVP parent (confirmer présence), chat séance, carte GPS | Vision |

---

## 9. Message pour le canal développeurs app

> **À faire immédiatement côté Expo :** consommer les nouveaux champs Event (`session_status`, `location_text`, `approval_status`, `notify_parents`, `started_at`, `completed_at`) ; brancher start/complete ; écran prefs parent `GET/PUT /parent/notification-prefs` ; afficher kinds de notifications ci-dessus. Ne pas inventer un second système WhatsApp — tout passe par l’app + `/notifications`. Multi-sport : labels FR/AR génériques (entraînement / match), pas de hardcode football seul.

---

*Document de pilotage — septembre 2026. Source de vérité produit pour le suivi parental.*
