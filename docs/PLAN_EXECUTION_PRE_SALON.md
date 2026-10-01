# Plan d’exécution — tout régler avant FormaTech

**Fichier opérationnel** (à suivre jour par jour).  
**Références :** `ORDRE_CORRECTIFS_PRE_SALON.md` · `RESTE_A_FAIRE_PAR_ROLE.md` · `ORDRE_DEV_APP_ANDROID.md`  
**Échéance salon :** 12–15 octobre 2026 · **Gel code :** 10 octobre · **Aujourd’hui :** 1 octobre 2026

**Règle :** ne pas inventer de parcours hors ordre. Chaque livraison site → §15 maître + journal Android.

---

## 1. Score actuel (ordre salon)

| Périmètre | Taux | Commentaire |
|-----------|-----:|-------------|
| Site + API (Lots A/B/C) | ~71 % | B1 HTTPS = 0 (bloquant #1) |
| Android Lot C | ~14 % | Pas d’APK 1.9 ; C7/C8/C11 ouverts |
| **Cible 10 oct.** | **100 % critères §8 ordre** | Hors Chargily / Redis / Play Store |

---

## 2. Calendrier respecté (recalé sur l’avancement réel)

Le planning J1–J11 de l’ordre salon reste la **loi**. Ci-dessous : ce qui reste **à faire**, pas ce qui est déjà fermé.

| Jour | Date | Contenu obligatoire restant | Owner | Statut |
|------|------|-----------------------------|-------|--------|
| **J1** | 1 oct. | Lancer ce fichier · **acheter domaine** · C3 Finance contenu AR · bump APK 1.9 · C7 app · D17 | Tous | 🔄 en cours |
| **J2** | 2 oct. | **B1** DNS + Caddy TLS + CORS + APK `https://` | Système + Android | ⏳ **bloque domaine** |
| **J3** | 3 oct. | B6 Render OFF · A6 tests parcours manquants · consentement / politique | Système + Web | ⏳ |
| **J4** | 4 oct. | C8 APK démo hors ligne · rehearsal seed | Android + Système | ⏳ |
| **J5** | 5 oct. | C3 Équipes + Matériel AR · polish C2 | Web | ⏳ (C2 site ✅) |
| **J6** | 6 oct. | Fin C3 · RTL démo scriptée | Web | ⏳ |
| **J7** | 7 oct. | **C4** super-admin lecture seule · C9 bandeau app | Web + Android | ⏳ |
| **J8** | 8 oct. | **A3** `club_id` strict · A9 si temps · A6 couverture | Système | ⏳ |
| **J9** | 9 oct. | Recette complète + revue senior + correctifs | Tous | ⏳ |
| **J10** | 10 oct. | **Gel** · dispositif stand 6.4 · répé | Tous | ⏳ |
| **J11** | 11 oct. | Répé finale · backup · logistique | Tous | ⏳ |

**Ne jamais sacrifier :** A1–A2–A4–A5–A7–A8–A10, B1, B2, J9/J10.  
**Variable d’ajustement (ordre) :** D → A9 → C4 → C3 Teams/Inventory → A3.

**Hors scope avant salon :** Chargily, quotas, sous-domaine, export fédération, Redis, découpage monolithes.

---

## 3. Checklist tâches (toutes — obligatoire)

### 3.1 Système / SaaS

| ID | Tâche | Priorité | État |
|----|-------|----------|------|
| B1 | Domaine + HTTPS + CORS | P0 | ❌ attendre achat domaine |
| A3 | Filtres `club_id` stricts / NOT NULL | P0 | ✅ filtres stricts (prod NULL=0) |
| A6 | Tests parcours finance / séances / upload | P1 | 🟡 23 verts |
| A9 | `/admin/clubs` suspendre (si temps) | P1 | ❌ (C4 lecture d’abord) |
| B6 | Décommissionner Render `wrbh-web.onrender.com` | P0 | 🟡 CORS coupé ; **suspendre service Render manuellement** |
| ANPDP | Déclaration + politique confidentialité | P0 hors-dev | ❌ utilisateur |
| Domaine | Achat DNS | P0 hors-dev | ❌ **utilisateur** |

### 3.2 Web

| ID | Tâche | Priorité | État |
|----|-------|----------|------|
| C2 | Licences / certificats + alertes | P0 | ✅ prod `5f6e658` |
| C3a | Finance contenu AR (mois, graphes, colonnes, toasts) | P0 | ✅ code |
| C3b | Équipes `useI18n` | P0 | 🟡 libellés principaux |
| C3c | Matériel `useI18n` | P0 | 🟡 libellés principaux |
| C4 | Console super-admin lecture seule | P0 | ✅ code |
| C5 | Essai réel (bandeau + écriture bloquée) | P0 | ✅ |
| D17 | Slug démo configurable (`VITE_DEMO_CLUB_SLUG`) | P0 | ✅ `web/src/config.ts` |
| D4 | Guard routes parent `/finance` | P1 | ⏳ |

### 3.3 Android

| ID | Tâche | Priorité | État |
|----|-------|----------|------|
| APK | Publier **1.9.0 / vc 12** | P0 | 🟡 version bumpée — rebuild APK à lancer |
| C12 | Message 403 | P0 | 🟡 code ; besoin APK |
| C9 | Bandeau club suspendu + masquer create | P0 | ✅ bandeau + readOnly Athlètes/Inscriptions |
| C7 | Licence + certificat médical fiche | P0 | ✅ code app |
| C8 | APK démo hors ligne (IP portable) | P0 | ⏳ |
| C11 | i18n Accueil + Agenda (+ RTL) | P0 | ⏳ |
| C2 | `https://` + retirer cleartext | P0 | ⏳ après B1 |
| C10 | Revalider notifs / enfants | P1 | ⏳ |

### 3.4 Critères de sortie (§8) — non cochés

- [ ] HTTPS valide + `isSecureContext`
- [ ] PWA installable
- [ ] APK en `https://`
- [ ] Démo 100 % hors ligne portable + téléphone
- [ ] Démo AR Accueil / Athlètes / Inscriptions / Agenda / Finance
- [ ] ANPDP + politique
- [ ] Recette + revue senior
- [ ] Gel 10 oct. + backup
- [ ] Couverture `finance.py` / `club.py` ≥ 50 % (cible A6)

---

## 4. Ordre d’attaque immédiat (J1 — aujourd’hui)

```
1. [USER] Acheter le domaine (débloque J2 = B1)
2. [DEV]  C3a Finance contenu AR
3. [DEV]  C4 API + page super-admin lecture seule
4. [DEV]  C3b/C3c titres Équipes + Matériel
5. [DEV]  Android 1.9.0 + C7 champs licence/médical
6. [DEV]  Confirmer D17 (env VITE_DEMO_CLUB_SLUG)
7. [DEV]  Mettre à jour ce fichier + §15 + RESTE à chaque merge
```

---

## 5. Journal d’avancement (append-only)

| Date | Livré | SHA / preuve |
|------|-------|--------------|
| 2026-10-01 | C2 site + C3 chrome Finance | `5f6e658` prod |
| 2026-10-01 | Création de ce plan + lancement C3a / C4 / C7 / APK 1.9 | (cette passe) |
| 2026-10-01 | **C3a** mois/graphes/colonnes/toasts Finance · **C3b/c** titres Équipes+Matériel · **C4** `GET /admin/clubs` + page `/platform` + compte `platform@nadi-connect.local` · **C7** champs licence app · bump **1.9.0/vc12** · D17 déjà `VITE_DEMO_CLUB_SLUG` | à déployer |
| 2026-10-01 | **A3** filtres `club_id` stricts (53+ remplacements, prod NULL=0) · **B6** CORS sans Render · **D17** `web/src/config.ts` · **C3** Teams/Inventory libellés · **C9** bandeau lecture seule app | Suspendre manuellement services Render ; rebuild APK 1.9 |

---

## 6. Sync Android (rappel livraison)

Toute feature site de ce plan → lignes dans `ORDRE_LOGICIEL_MAITRE.md` §15 **et** tâches « À ajouter » dans `ORDRE_DEV_APP_ANDROID.md`.
