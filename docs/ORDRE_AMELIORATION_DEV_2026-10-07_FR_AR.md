# Ordre d’amélioration — développeur (site + app)

**Date :** 2026-10-07 (màj 03h05)  
**Score live :** **≈ 84 %** ([`TABLEAU_FIABILITE_MODULES_2026-10-07_FR_AR.md`](TABLEAU_FIABILITE_MODULES_2026-10-07_FR_AR.md))  
**Cible :** **≥ 90 %** (seuil commercialisation B)  
**Reste :** [`RESTE_A_REGLER_FIABILITE_100.md`](RESTE_A_REGLER_FIABILITE_100.md)  
**App mesurée :** Nox **1.18.2** · API `git_sha=android-1.18`

**Règles :**
1. Ne cocher **FAIT** qu’avec preuve **prod** (`git_sha` + UI Cursor / Nox).  
2. Site = source de vérité · l’app **ne invente pas** de parcours.  
3. Chaque lot web clos → §15 `ORDRE_LOGICIEL_MAITRE.md` + journal `ORDRE_DEV_APP_ANDROID.md`.

---

## Français

### Objectif

Passer de **≈ 84 % → ≥ 90 %** en fermant **uniquement** le reste mesuré le 07/10 ~03h.  
Ne **pas** rouvrir les points déjà **CLOS** : G0-04/05/06, G0-03 (liste après charge), G1-02/04/05(API)/07, onglets app + Plus Athlètes/Inscriptions/Comptes.

### Ordre d’exécution (obligatoire)

```
W1  Historique web (/history → GET /audit)
W2  G0-03b  1er paint Équipes (skeleton, zéro flash « Aucune équipe »)
W3  Annonces fil web = GET /announcements
W4  G1-06   Import CSV multipart + OpenAPI
W5  Finance UI âge max = settings API (affichait 17 alors qu’API = 55)
        ↓
A1  Plus → Matériel (land inventaire)
A2  Plus → Historique (land audit) — stabiliser (flaky sur 1.18.2)
A3  Plus → Annonces (land fil)
A4  APK ≥ 1.18.3 si correctifs nav + UpdateGate
        ↓  (rejeu QA → score ≥ 90 %)
P2  G2-03 familial → G2-04 QR/claim → G2-05 Feedback
```

---

### Lot W — Site / API (développeur web) — **PRIORITÉ 1**

| # | ID | Action | Preuve de done | Où |
|---|-----|--------|----------------|-----|
| **W1** | Historique UI | Brancher `/history` sur `GET /api/v1/audit` ; plus de « Chargement… » + **Réessayer** si API 200 | Journal visible sans Réessayer | page Historique |
| **W2** | **G0-03b** | Skeleton / garder dernière liste — **jamais** « Aucune équipe » pendant le fetch (~1–3 s flash actuel) | 0 flash vide sur `/teams` | page Équipes |
| **W3** | Annonces fil | Fil = `GET /announcements` (Sisi n≈16) | Plus « Aucune annonce » si API non vide | page Annonces |
| **W4** | **G1-06** | `POST /api/v1/athletes/import` multipart `.csv` fonctionnel + chemin OpenAPI | Import → **200** + lignes créées | API + UI Importer |
| **W5** | Âge UI Finance | Champs min/max lus depuis `GET /finance/settings` (prod max **55**) | Formulaire Finance = API | page Finance |

**Déploiement :** chaque Wi = commit + **deploy VPS** + noter nouveau `git_sha` avant FAIT.

---

### Lot A — Application Android (développeur app) — **PRIORITÉ 2**

| # | ID | Action | Preuve de done |
|---|-----|--------|----------------|
| **A1** | **G2-01b** | Plus → **Matériel** : entrée + `router.push` → inventaire | Nox : stock / articles |
| **A2** | G2-01 | Plus → **Historique** **stable** (souvent fail Automator 1.18.2) | Land audit |
| **A3** | — | Plus → **Annonces** = fil site | Land annonces |
| **A4** | Build | APK **≥ 1.18.3** + UpdateGate | Install Nox + smoke 6 écrans Plus |

Détail technique : **§9octies** [`ORDRE_DEV_APP_ANDROID.md`](ORDRE_DEV_APP_ANDROID.md).  
Attendre W1/W3 déployés pour ne pas montrer des écrans vides alors que l’API a des données.

---

### Lot P2 — Après score ≥ 90 % (non bloquant salon)

| ID | Action |
|----|--------|
| **G2-03** | Paiement familial (1→N) **ou** message clair « 1 paiement = 1 athlète » |
| **G2-04** | Module QR **ou** retrait claim marketing |
| **G2-05** | Feedback-admin SPA stable |

---

### Checklist développeur

**Web**
- [x] W1 Historique = `/audit` *(Actualiser vs Réessayer ; garde liste)* — **code** ; FAIT prod après deploy  
- [x] W2 G0-03b skeleton équipes — **code**  
- [x] W3 Fil Annonces = API (array + loading) — **code**  
- [x] W4 CSV import JSON + multipart + OpenAPI — **code**  
- [x] W5 Finance âge UI défaut **55** — **code**  
- [ ] Deploy + `git_sha` changé *(SSH VPS requis)*  
- [ ] Rejeu Cursor prod après deploy  

**App**
- [x] A1 Matériel Plus *(titre + testID + push)* — **code 1.18.3**  
- [x] A2 Historique Plus — **code**  
- [x] A3 Annonces Plus (entrée dédiée) — **code**  
- [ ] APK ≥ 1.18.3 publié + Nox *(build ops)*  
- [ ] Smoke Plus 6 écrans  

**Interdit**
- Marquer FAIT sans preuve prod  
- Inventer un parcours app ≠ site  
- Attaquer P2 avant W1–W5 + A1–A3 deployés  

**P2** (G2-03…05) : **reporté** jusqu’à score ≥ 90 % après deploy + APK.

---

### Impact Android (couture site)

| Livraison site | À AJOUTER dans l’app |
|----------------|----------------------|
| W1 Historique `/audit` | A2 écran Historique même payload |
| W3 Annonces fil | A3 écran Annonces |
| W4 Import CSV | Option import hors scope v1 **ou** même endpoint si déjà prévu §9sexies |
| W5 Âge settings | Afficher plage âge club (déjà partiel Paiements) |

---

## العربية

### الهدف
من **≈ 84٪ → ≥ 90٪**. لا تعِد فتح البنود المغلقة.

### ترتيب إلزامي
```
W1 تاريخ الويب → W2 فرق بلا وميض → W3 إعلانات = API → W4 CSV → W5 عمر Finance UI
        ↓
A1 مواد → A2 تاريخ → A3 إعلانات (Plus) → A4 APK ≥1.18.3
        ↓
P2 عائلي / QR / Feedback (بعد ≥90٪ فقط)
```

| # | المطوّر يفعل | إثبات |
|---|--------------|--------|
| W1 | `/history` = `GET /audit` | بدون Réessayer وهمي |
| W2 | لا « Aucune équipe » أثناء التحميل | skeleton |
| W3 | قائمة الإعلانات = API | ليس فارغًا وAPI فيها بيانات |
| W4 | استيراد CSV multipart | 200 |
| W5 | حقول العمر = settings | max يظهر 55 إن وُجد |
| A1–A3 | Plus → Matériel / Historique / Annonces | Nox land |
| P2 | بعد 90٪ فقط | — |

**قاعدة:** لا « FAIT » بدون إثبات إنتاج.

---

## Journal

| Date | Note |
|------|------|
| 2026-10-07 03h00 | Création ordre post-rejeu % ≈ 85 %. |
| 2026-10-07 03h05 | Resync score **≈ 84 %** ; ajout **W5** âge Finance UI ; app mesurée **1.18.2**. |
| 2026-10-07 03h35 | **Code W1–W5 + A1–A3** livré en repo (APK cible **1.18.3**). Deploy VPS + build APK encore requis pour FAIT prod. P2 reporté. |
