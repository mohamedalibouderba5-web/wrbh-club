# Repère projet Nadi Connect — guide développeur humain

**Fichier repère (onboarding / reprise de projet).**  
À lire **en premier** si vous reprenez le code ou continuez le développement.

**Produit :** Nadi Connect (نادي كونكت) — SaaS multi-clubs / multi-sports (Algérie)  
**Dernière mise à jour de ce repère :** 2026-10-06  
**Langue docs statut :** FR + AR quand rapport / matrice

---

## 1. En une minute

| Élément | Valeur |
|---------|--------|
| Marque logicielle | **Nadi Connect** uniquement (jamais « WRBH Club » comme nom du produit) |
| Un club (ex. WRBH, Sisi) | = **tenant / client**, pas la marque |
| Source de vérité métier | **Site web** → l’app Android **miroite** |
| Code | Monorepo : `backend/` · `web/` · `mobile/` · `docs/` |
| Prod VPS | Hetzner **ali-server** `46.224.38.201` · `/opt/wrbh-club` · compose `wrbh` · ports **8080** web / **8081** API |
| Domaines | `https://nadi-connect.com` · `https://api.nadi-connect.com` |
| API cible | ≥ **1.18.0** (`GET /health`) |

---

## 2. Architecture (où est quoi)

```
Gestion Club Sportive/
├── backend/app/          # FastAPI — API /api/v1/*
│   ├── api/              # club, agenda, finance, auth, …
│   ├── services/         # fees, notify, broadcast, parental, …
│   ├── models/           # SQLAlchemy
│   └── core/             # tenant, roles, database, security
├── web/src/              # React + Vite — PWA
│   ├── pages/            # écrans métier
│   ├── roles/access.ts   # menus / caps par rôle (réf. app)
│   └── components/       # NotificationBell, …
├── mobile/               # Expo React Native — package dz.wrbh.club
├── docs/                 # Ordres, matrices, audits, ce repère
└── .cursor/rules/        # Règles agent (marque, Hetzner, ordres, FR/AR…)
```

**Multi-tenant :** presque toutes les tables métier ont `club_id`. Ne jamais requêter sans scope club (sauf superadmin plateforme).

---

## 3. Carte des documents (ordre de lecture)

| Priorité | Fichier | Rôle |
|----------|---------|------|
| 1 | **Ce fichier** `REPERE_PROJET_NADI_CONNECT_FR_AR.md` | Vue d’ensemble + historique condensé |
| 2 | `ORDRE_LOGICIEL_MAITRE.md` | Comportement produit + **§15 Journal** (append-only) |
| 3 | `ORDRE_DEV_APP_ANDROID.md` | Ce que l’app doit **AJOUTER** (§9quater, §9quinquies…) |
| 4 | `MATRICE_ROLES_ACCES.md` | Droits exhaustifs par rôle |
| 5 | `ORDRE_DEV_SUIVI_PARENTAL.md` | Cycle séances / parents |
| 6 | `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md` | Qui reçoit quelles notifs |
| 7 | Audits / Hydra / Sisi | Dossiers `docs/` + `Audit_Nadi_Connect_*` |

**Règle synchro :** chaque livraison site → ligne §15 maître + « À AJOUTER » dans ordre Android.

---

## 4. Rôles utilisateurs (résumé)

| Rôle | Espace typique |
|------|----------------|
| `admin` / `direction` | Club complet (+ comptes pour direction/admin) |
| `staff` | Ops quotidiennes (pas comptes) |
| `coach` | Équipes / agenda / présences (pas finance club) |
| `parent` | Enfants / agenda / inscriptions / notifs |
| `superadmin` | `/platform` multi-clubs |

Détail UI web : `web/src/roles/access.ts` · Doc : `INTERFACES_PAR_ROLE_FR_AR.md`.

---

## 5. Historique condensé (étapes majeures)

> Le détail jour par jour = **§15** de `ORDRE_LOGICIEL_MAITRE.md` (append-only). Ci-dessous : jalons pour comprendre le fil.

| Période | Étape |
|---------|--------|
| Origine | Gestion club (héritage technique `wrbh_*`) → rebrand **Nadi Connect** |
| 2026-09 | App parentale miroir, multi-club login, menus rôles |
| 2026-10-01 | Audits commercialisation / pré-salon · Lot A tenant (`club_id`) · HTTPS/DNS · guides · matrice rôles |
| 2026-10-03 | Correctifs IDOR / Codex · fiabilité finance / agenda |
| 2026-10-04 | Clubs essai **Sisi** · densité UX web · Hydra prep · APK **1.15.0** / **1.16.0** |
| 2026-10-05 | Hydra P1 (équipement, stats, search, échéances) · **interfaces Parent/Coach/Admin** web · audit Nox app vs web · ordre **§9quater** |
| 2026-10-06 | **Hub notifications** (broadcast par rôle + cloche Chrome + son) · ordre app **§9quinquies** (push + dashboards) · ce **fichier repère** |

---

## 6. État actuel (2026-10-06) — à connaître

| Domaine | État |
|---------|------|
| Site web prod | Vivant sur Hetzner + DNS ; rôles UI ; cloche notifs |
| API | 1.18.0 ; `broadcast.py` fan-out notifs |
| App Android | Miroir partiel ; **retard produit** vs web sur Hydra/rôles/notifs push — suivre §9quater + §9quinquies |
| Club test fréquent | `sisi-blida-13315` (stress ~300 athlètes) |
| Preuves audit app | `mobile/dist/deep_audit/` · rapport `RAPPORT_AUDIT_APPROFONDI_APP_ANDROID_VS_WEB_2026-10-05_FR_AR.md` |

---

## 7. Notifications (rappel)

Voir tableau détaillé : **`RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md`**.

Code clé :
- `backend/app/services/notify.py` — écriture `Notification`
- `backend/app/services/broadcast.py` — diffusion par rôle
- `backend/app/services/parental.py` — cycle séance parents
- `web/src/components/NotificationBell.tsx` — UI + Chrome + son

---

## 8. Déploiement & ops

| Action | Comment |
|--------|---------|
| Deploy typique | `tar` → VPS `/opt/wrbh-club` → `docker compose -p wrbh build/up` |
| Health | `https://api.nadi-connect.com/health` |
| APK publique | `https://nadi-connect.com/...apk` + page `/download` |
| Ne pas toucher | `/opt/esta` (autre projet) |

SSH / clés : environnement Ali (Hetzner). Ne pas committer secrets (`.env`, credentials).

---

## 9. Conventions pour un développeur qui reprend

1. **Ne pas renommer** le produit hors « Nadi Connect ».  
2. Toute feature visible → mettre à jour **maître §15** + **ordre Android** si impact app.  
3. Rapports statut / matrices → **FR + AR**.  
4. Isolation `club_id` = non négociable.  
5. Browser de vérif projet = navigateur intégré Cursor (pas Chrome externe pour demos agent).  
6. Commits : seulement si demandé explicitement.  
7. Lire `.cursor/rules/*.mdc` (marque, Hetzner, ordres, noms de discussions).

---

## 10. Backlog prioritaire (orientation)

1. App : finir **§9quater** (si restes) + **§9quinquies** (push + dashboards).  
2. Hydra P2 / saisons selon `ORDRE_HYDRA313_*` si ouvert.  
3. Continuer cloisonnement tenant / tests IDOR.  
4. Ne pas inventer paiement en ligne / QR-RFID sans ordre produit.

---

## 11. Contact documents « suite »

| Besoin | Doc |
|--------|-----|
| Droits exacts | `MATRICE_ROLES_ACCES.md` |
| Sync app | `ORDRE_DEV_APP_ANDROID.md` |
| Séances parents | `ORDRE_DEV_SUIVI_PARENTAL.md` |
| Notifs tableau | `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md` |
| Journal exhaustif | `ORDRE_LOGICIEL_MAITRE.md` §15 |

---

## العربية — ملخص الملف المرجعي

هذا الملف **مرجع المشروع** لمطوّر بشري يستلم الكود.

- المنتج: **Nadi Connect** (النادي = عميل/مستأجر وليس اسم البرنامج).  
- الحقيقة المصدر: **الموقع** ثم التطبيق يMirror.  
- اقرأ أولاً: هذا الملف → `ORDRE_LOGICIEL_MAITRE.md` (§15) → `ORDRE_DEV_APP_ANDROID.md`.  
- الإشعارات حسب الدور: `RAPPORT_NOTIFICATIONS_PAR_ROLE_FR_AR.md`.  
- الإنتاج: VPS Hetzner `/opt/wrbh-club`.  
- حدّث دائماً دفتر الأوامر عند كل تسليم.

**تاريخ هذا المرجع:** 2026-10-06.
