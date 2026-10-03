# Rapport — Reste à régler pour fiabilité ~100 %

**Date :** 2026-10-03 (~16h45) — **màj après corrections livrées**  
**Prod :** `git_sha=6ffcbecf6265` · API 1.18.0  
**Définition « 100 % » :** 0 FAIL S0/S1 + **R0 / W0 / M0** verts sur HTTPS **client**.  
**Durée restante :** **~2–5 jours** — **pas** un chantier de plusieurs mois.  
**Fichiers jumeaux :** `RESTE_A_REGLER_FIABILITE_100.md` · `RESTE_A_FAIRE_PAR_ROLE.md`

---

## 1. Déjà clos (code + deploy)

| ID | Livrable | Preuve |
|----|----------|--------|
| **A2** | Équipes saison courante par club | Live 126 ; commit `6f1efcb` |
| **A3** | Quick-pay impute l’échéance due | Code + pytest ; live imputait due |
| **A4** | Deploy | Prod **`6ffcbecf6265`** |
| **B1–B4 / C2** | Listes hydrate, chrome nom club, trial, suspend lecture, children IDOR, inventory rôles | Lot B/C déployé |
| **C1** | Pytest régression | **31/31** local |

→ Les **modifications et corrections** de l’ordre de réparation sont **faites**.  
→ Il ne reste **pas** à « tout créer » : il reste à **prouver** sur HTTPS client + téléphone.

---

## 2. Ce qui reste vraiment (court)

### Bloquant ops — A1 / P0-1
Stabiliser `https://api.nadi-connect.com` pour navigateur / Windows / 4G.  
Observé 16h45 : WebFetch health **OK** (`6ffcbec`) ; navigateur Cursor encore `Failed to fetch` ; httpx Windows timeout.  
Sans A1 stable → pas de GO, pas de M0 officiel.

### Recettes — Lot B / P1 (~1 j)
Rejouer listes, chrome, équipes/agenda UI, suspend, trial, rôles (code déjà là).

### Android — Lot D / P2 (~1–1,5 j)
Checklist M0 téléphone 4G **après** A1 vert.

### Batterie — P3 (~1 j)
R0-10/14, R1 smoke, polish S2/S3 optionnel.

---

## 3. DoD

| DoD | État |
|-----|------|
| Code P0/P1 métier déployé | **Oui** (`6ffcbec`) |
| Domaine API health **stable client** | **Non** (intermittent / Failed to fetch) |
| Login web 2 clubs | Bloqué A1 |
| R0 / W0 / M0 100 % | À rejouer sur HTTPS client |
| pytest | **31** OK local |
| 0 S0 | À confirmer après rejeu HTTPS |

**Avancement code réparation :** ~**90 %** (seul A1 ops manque côté infra).  
**Avancement DoD « fiable » :** ~**40 %** — le reste est **preuve + ops**, pas réécriture.

---

## 4. Une phrase décideur

**Équipes, paiements, suspend, children et listes sont corrigés et déployés (`6ffcbec`) ; il reste surtout à stabiliser le domaine API côté client, puis 2–5 jours de recettes web + téléphone — pas dix mois de création.**

---

## Journal

| Date | Note |
|------|------|
| 2026-10-03 16h30 | Première version reste. |
| 2026-10-03 16h40 | Sync A2/A3 clos. |
| 2026-10-03 16h45 | Sync `6ffcbec` Lot B/C ; pytest 31 ; reste A1 + recettes + M0 ; **2–5 j**. |
