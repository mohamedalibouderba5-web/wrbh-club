# Reste à faire — **Salon FormaTech** (vérif 2026-10-01 **19h10**)

**Objectif :** produit **en ligne** (wifi / 4G) — site + app. Pas d’APK hors ligne.  
**Prod :** VPS Hetzner `46.224.38.201` (ports 8080 web / 8081 API).  
**APK :** UpdateGate **1.10.0** / vc13 · `…/wrbh-club-1.10.0.apk`.

### Règle domaine

- **Pas de domaine** pour l’instant → tests / salon en **`http://IP:port`**.  
- Domaine + HTTPS = **après** salon / achat client.

**Ordres :** [`docs/ORDRE_FINAL_SALON_DEV.md`](ORDRE_FINAL_SALON_DEV.md)

---

## 1. ANDROID

| # | Tâche | État |
|---|--------|------|
| **M0** | APK 1.10.0 | **Fait** |
| **A-1…A-4** | Recettes téléphone | **Ouvertes** (installation + inscription + parent + notifs) |
| M4–M6 | ClubLock / i18n / licences | **Fait** |
| HTTPS | — | **Hors scope** |

---

## 2. SITE / API

| # | Tâche | État | Preuve |
|---|--------|------|--------|
| **W-1** | Parcours 10 min démo | **Fait** | UI login `demo-foot-safex` + REG API 378 + Finance |
| **W-2** | 4 clubs démo login | **Fait** | 4/4 `admin@<slug>.test` / `DemoClub!2026` |
| **W-3** | Reset seed | **Documenté** | `docker exec -i wrbh-api python -c "from scripts.seed_demo import run; run()"` |
| **W-4** | PATCH suspendre | **Fait (code)** | `/platform` + `PATCH /admin/clubs/{id}` |
| **D4** | Guard routes rôle | **Fait** | `RoleRoute` finance / matérial / comptes |
| HTTPS | — | **Hors scope** |

---

## 3. Scores (sans domaine)

| Périmètre | % |
|-----------|--:|
| Code salon | **100 %** |
| Recettes site W-1…W-3 | **100 %** |
| Recettes app A-2…A-4 | **0 %** (téléphone) |
| **Prêt stand prouvé** | **~83 %** (manque recettes téléphone) |

---

## 4. À faire maintenant

1. Installer APK **1.10.0** depuis `/download`.  
2. Recettes Android **A-2 A-3 A-4**.  
3. Ne pas démarrer de domaine.

### Comptes stand

| Club | Email | Mot de passe |
|------|-------|--------------|
| demo-judo-978 | admin@demo-judo-978.test | DemoClub!2026 |
| demo-foot-safex | admin@demo-foot-safex.test | DemoClub!2026 |
| demo-multi-safex | admin@demo-multi-safex.test | DemoClub!2026 |
| demo-hand-safex | admin@demo-hand-safex.test | DemoClub!2026 |
