# Reste à régler — pour atteindre 100 % fiabilité

**Date :** 2026-10-03 (~16h45) — **màj après corrections livrées + vérif**  
**Prod :** `git_sha=6ffcbecf6265` · API **1.18.0** · Nadi Connect  
**Objectif :** 0 FAIL S0/S1 + tiers **R0 + W0 + M0** verts sur HTTPS client.  
**Durée restante réaliste :** **~2–5 jours** (ops + recettes + téléphone) — **pas** des mois de développement.  
**Référentiels :** `ORDRE_REPARATION_FIABILITE_100.md` · `RAPPORT_RESTE_FIABILITE_100.md` · `BATTERIE_TESTS_FIABILITE.md`

---

## 0. Déjà réglé (code + deploy) — ne plus re-coder sauf régression

| Item | Preuve |
|------|--------|
| **A2** Équipes saison courante **par club** | Live IP : `GET /teams` = 126 = avec `season_id` ; commit `6f1efcb` |
| **A3** `payments/quick` impute l’échéance due | Code + pytest double-pay ; live imputait même `installment_id` |
| **A4** Deploy P0 puis Lot B/C | Prod **`6ffcbecf6265`** (après `6f1efcb`) |
| **B1** Faux « Réessayer » / hydrate JWT | Code web déployé (Lot B/C) |
| **B2** Chrome = **nom du club** | `AppLayout` + bootstrap |
| **B3** Essai expiré write-lock | `tenant.py` + pytest |
| **B4** Club suspendu : login lecture / écritures 403 | Lot B/C déployé + pytest |
| **C2** `/mobile/children` IDOR | Strict `club_id` + pytest |
| Inventaire rôles staff+ | Lot B/C |
| Pytest local | **31/31** verts |
| Isolation multi-tenant | R0-02 OK (IP) |
| Landing + Download APK | W0-01 / W0-15 OK |

→ Les **modifications / corrections métier** sont **faites et déployées**.  
→ Ce qui reste n’est **pas** « créer le produit pendant dix mois » : c’est **stabiliser l’accès HTTPS client** + **recettes de preuve** + **téléphone**.

---

## 1. P0 encore ouvert (seul bloquant ops)

| # | Reste | IDs | Quoi faire | OK quand | Durée |
|---|-------|-----|------------|----------|-------|
| ~~**P0-1 / A1**~~ | ~~Domaine API instable~~ | — | **Contournement livré :** web **same-origin** (`nginx` `/api`→API, `VITE_API_URL=`). Login + modules OK via `http://IP:8080` / `nadi-connect.com` sans appeler `api.*`. Sous-domaine `api.nadi-connect.com` encore timeout depuis certains réseaux Windows (Cloudflare) — **Android** doit encore le stabiliser ou utiliser même host. | Login web débloqué | **partiel** |
| ~~**P0-3**~~ | Login web | W0-03 | **OK** navigateur Cursor : `demo-foot-safex` → dashboard + chrome club | Session OK | **CLOS** |

| ~~P0-2~~ | ~~Paiements quick~~ | — | **CLOS** code+deploy | — | — |

**Critère stop :** si P0-1 encore FAIL client → pas de GO commercialisation / M0 officiel.

---

## 2. P1 — surtout **recettes** (code déjà en place)

À rejouer **dès que P0-1 vert** (pas de gros développement attendu).

| # | Reste | Nature | OK quand | Durée |
|---|-------|--------|----------|-------|
| **P1-1** | Listes sans Réessayer | Recette | Cold-load Athlètes / Inscriptions / Finance / Historique / Feedbacks | 0,5 j |
| **P1-2** | Chrome nom club | Recette UI | Topbar = nom tenant + marque Nadi Connect | 0,25 j |
| **P1-3** | Équipes / Agenda UI | Recette | `/teams` + select agenda remplis | 0,25 j |
| **P1-4** | Club suspendu | Recette prod | POST 403 / GET OK / bandeau | 0,25 j |
| **P1-5** | Essai expiré | Recette prod | Write lock + bandeau | 0,25 j |
| **P1-6** | `/mobile/children` | Smoke API HTTPS | Parent A ≠ enfants B | 0,25 j |
| **P1-7** | Coach `must_change_password` | Compte jetable | Gate web+app | 0,25 j |
| **P1-8** | Guards rôles UI | Recette | Parent sans Finance/Comptes | 0,5 j |
| **P1-9** | Matériel / sports UI | Recette (+ fix si FAIL) | Stock + sports visibles | 0,25 j |

---

## 3. P2 — Android téléphone (recettes)

APK HTTPS / Lot D (1.13 / piste 1.14). **Pas de rebuild** tant que P0-1 n’est pas vert.

| # | Reste | IDs | Durée |
|---|-------|-----|-------|
| **P2** | Checklist **M0** sur téléphone **4G** | M0-01…16 | **1–1,5 j** |

---

## 4. P3 — Fermer la batterie (après P0/P1)

| Zone | Reste | Durée |
|------|-------|-------|
| R0-10 / R0-14 | Rate-limit compte jetable · JWT forgé | 0,5 j |
| R1 prioritaire | Smoke métier restant | 0,5–1 j |
| R2 / W1 / W2 / Lot E | Volume, CRUD modules, polish S2/S3 | 1–2 j (après GO métier) |

---

## 5. Plan court (jours, pas mois)

```
J0     P0-1 domaine API + login web 2 clubs
J0–J1  Recettes P1-1…P1-3 (+ finance UI = A3 déjà OK)
J1     P1-4…P1-9 (suspend, trial, rôles, children, matériel)
J1–J2  P2 Android M0 téléphone 4G
J2–J4  R0 restants + R1 smoke → GO-100 % batterie
```

**Total indicatif DoD R0+W0+M0 : 2–5 jours.**

| Jalon | Condition |
|-------|-----------|
| **GO-ops** | P0-1 vert (navigateur + 4G) |
| **GO-métier** | Paiements **déjà OK** + P1-1 + P1-3 verts |
| **GO-cycle club** | P1-4 + P1-5 verts |
| **GO-app** | M0 (P2) 100 % téléphone |
| **GO-100 %** | R0+W0+M0 verts + 0 S0 |

---

## 6. Checklist courte « reste » (à cocher)

- [ ] API domaine **stable** navigateur / Windows / téléphone  
- [x] Paiements quick imputent l’échéance due (**code+deploy**)  
- [x] Équipes `GET /teams` sans param OK (**code+deploy**)  
- [x] Suspend / trial / children IDOR / hydrate listes (**code+deploy** `6ffcbec`)  
- [x] Pytest **31** verts  
- [ ] Login web Horizon + Audit (dépend P0-1)  
- [ ] Recettes P1 listes / chrome / équipes UI  
- [ ] Recettes suspend + essai expiré en prod  
- [ ] Checklist M0 Android téléphone  
- [ ] R0-10 / R0-14 + R1 smoke  

---

## 7. Hors scope

- Renommage marque / marketing  
- Nouvelles features salon  
- Rebuild APK avant P0-1 vert  

---

## Journal

| Date | Note |
|------|------|
| 2026-10-03 | Liste initiale. |
| 2026-10-03 16h40 | Voie vérifiée : A2+A3 clos ; durée 3–6 j. |
| 2026-10-03 16h45 | **MàJ** prod `6ffcbec` + Lot B/C (suspend, children, listes) ; pytest **31** ; reste surtout **A1 ops** + recettes + M0 ; durée **2–5 j**, pas mois. |
| 2026-10-03 17h00 | **Same-origin API** déployé (nginx `/api`+`/media`) ; login web OK ; R0-12 quick pay match installment OK ; sync 10 équipes demo-foot ; chrome = nom club. |

---

*Document action — cocher au fur et à mesure des rejeux.*
