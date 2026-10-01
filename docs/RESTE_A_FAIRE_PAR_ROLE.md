# Reste à faire — répartition par développeur

**Vérifié le :** 2026-10-01 à **16h10** (6ᵉ vérification)
**Échéance :** FormaTech Expo, **12–15 octobre 2026**, SAFEX Pavillon A, Alger
**Méthode :** code + production. Un titre de commit n’est jamais pris pour une tâche close.

**Documents de référence :**
- Plan opérationnel : `docs/PLAN_EXECUTION_PRE_SALON.md`
- Ordre backend / web : `docs/ORDRE_CORRECTIFS_PRE_SALON.md`
- Ordre Android : `docs/ORDRE_DEV_APP_ANDROID.md` §9

---

## 0. Taux (ordre salon)

| Périmètre | Score | Lecture |
|-----------|------:|---------|
| Site + API A/B/C | **~18 / 21 ≈ 86 %** | A3 + B6 code avancés ; **B1 toujours 0** |
| Android P0 | **~3,2 / 8 ≈ 40 %** | C7+C9 code ; **APK 1.9 non publié** |

---

## 1. Fermé depuis 15h52

| Réf | Preuve |
|-----|--------|
| **A3** | Filtres `or_(…, club_id.is_(None))` → `club_id ==` (53+ sites API). Prod : 0 NULL athlètes/users/regs. Restent 4 `is_(None)` (saison orpheline, login soft superadmin, feedback plateforme). |
| **B6 (code)** | CORS / defaults sans `wrbh-web.onrender.com`. **À faire user :** Suspendre le service Render (dashboard). |
| **D17** | `web/src/config.ts` → `DEMO_CLUB_SLUG` + `web/.env.example`. |
| **C3** | Teams/Inventory libellés FR/AR ; Finance `financePayroll`. |
| **C9** | `ClubLockProvider` bandeau + `readOnly` Athlètes / Inscriptions. |

---

## 2. Encore ouvert (P0)

| Réf | Owner | Action |
|-----|-------|--------|
| **B1** | Vous | **Acheter le domaine** demain → DNS + Caddy TLS |
| **B6 fin** | Vous | Suspendre `wrbh-web` (+ `wrbh-api` si encore allumé) sur Render |
| **APK 1.9.0** | Android | `eas build` / export → `web/public/wrbh-club-1.9.0.apk` |
| **C8** | Android | APK démo IP portable |
| **C11** | Android | i18n Accueil + Agenda |
| **C3 profondeur** | Web | Tableaux Teams/Inventory restants si temps démo AR |
| **A6** | Système | Tests parcours manquants |
| ANPDP | Vous | Déclaration + politique |

---

## 3. Ordre demain (2 oct. = J2 plan)

```
1. ACHETER DOMAINE + pointer vers 46.224.38.201
2. B1 : Caddy TLS api.<domaine> + www + CORS
3. Suspendre Render (B6)
4. Rebuild APK 1.9.0 + republier
5. Préparer switch app.json https (après TLS OK)
```

---

## 4. Historique

| Heure | Fermé | Ouvert |
|-------|-------|--------|
| 15h52 | C4 C3 Finance C7 bump 1.9 | B1 A3 D17 B6 APK |
| **16h10** | **A3** filtres · **B6 CORS** · **D17** · **C9** · C3 Teams/Inv | **B1** · Suspend Render · **APK 1.9** · C8 C11 |
