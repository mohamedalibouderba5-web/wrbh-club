# Plan d’implémentation — Web + Mobile + API

## Architecture

```
┌─────────────┐     ┌──────────────┐
│  Web React  │────▶│              │
│  (admin…)   │     │  FastAPI     │──── PostgreSQL / SQLite
└─────────────┘     │  JWT API     │
┌─────────────┐     │  /api/v1/*   │
│ Expo Mobile │────▶│  /health     │
│ parent/coach│     └──────────────┘
└─────────────┘
```

**Règle :** une seule API ; web et mobile = clients.

## Ordre (aligné mission)

| Phase | Livrable | Clients |
|-------|----------|---------|
| 1 | Scan + schéma + seed Excel | — |
| 2 | Auth JWT + rôles + structure club | API |
| 3 | Athlètes, inscriptions, agenda | Web + API |
| 4 | Finance cotisations / dépenses / paie | Web + API |
| 5 | App mobile parent (enfants, agenda, paiements, annonces, push) | Mobile |
| 6 | Présences coach + communication | Mobile + Web |
| 7 | Inventaire, branding, health/wake, Render + guides build | Tous |

## Endpoints clés mobile

- `POST /api/v1/auth/login` — JWT partagé
- `GET /api/v1/mobile/home` — résumé léger parent/coach
- `GET /api/v1/mobile/children` — enfants du parent
- `GET /api/v1/mobile/agenda` — événements filtrés
- `POST /api/v1/mobile/convocations/{id}/respond`
- `GET /api/v1/mobile/payments`
- `POST /api/v1/mobile/push-token`
- `POST /api/v1/system/wake` + `GET /health`

## Branding UI

- Logo WRBH, bleu/jaune
- Web : dashboard pro admin
- Mobile : UX ultra-simple parents (onglets Accueil / Agenda / Paiements / Messages / Profil)
- Bilingue FR + labels AR clés

## Hébergement gratuit

- API : Render free (cold start → bouton Réveiller web + mobile)
- DB : Neon/Aiven Postgres free
- Web : Render static / Cloudflare
- Mobile : EAS Build → APK + TestFlight ; page `/download`
