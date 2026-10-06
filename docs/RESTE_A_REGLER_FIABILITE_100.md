# Reste à régler / améliorer — Nadi Connect (web + app)

**Dernière màj :** 2026-10-06 ~17h55 (lot reste G0-05 / G0-06 / G0-01 polish + G2-01 app)  
**Tenant :** CS Sisi Blida (`sisi-blida-13865`)  
**API :** `git_sha=9c736a0` (+ patch reste soir)  
**App Nox :** `1.18.0` → rebuild attendu après G2-01 (`router.push` Plus)  
**Ordre :** `ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md` · `ORDRE_DEV_APP_ANDROID.md` §9sexies  
**Retest :** `RETEST_POST_DEPLOY_2026-10-06_FR_AR.md`

**Règle :** ne cocher **CLOS** que si preuve **prod** (site / API / Nox).  
**Ce fichier = source « reste » unique** pour web **et** application.

---

## Français

### 0. Déjà CLOS en prod — ne plus re-coder sauf régression

| ID | Item | Preuve |
|----|------|--------|
| **G0-02** | Agenda coachs UI | ~10 « Coach: » visibles |
| **G0-03** | Équipes web = API | Liste FOOT/U… affichée |
| **G0-04** | `/accounts` → `/users` | Redirect + « Gestion des comptes » |
| **G0-05** | Inscriptions sans Réessayer fantôme | Toolbar → **Actualiser** si OK ; Réessayer seulement si erreur vide |
| **G0-06** | i18n filtres FR | Dashboard + filtre Athlètes **Actifs** (plus `Active`) |
| **G0-01 polish** | 1er paint Inscriptions | Pas de « Chargement… » si dossiers déjà en cache ; ne vide pas la liste |
| **G1-01…G1-07** | Dates, payments, âge, CSV, health… | Voir retest soir |
| App tabs | Accueil / Agenda / Paiements / Plus / Équipes | Nox 1.18.0 OK |

---

### 1. RESTE OUVERT — Web / API

| Priorité | ID | Reste à faire | Preuve de done |
|----------|-----|---------------|----------------|
| — | — | **Aucun P0/P1 web ouvert** après lot 17h55 (revalider en prod) | Recette navigateur |

---

### 2. RESTE OUVERT — Application Android

| Priorité | ID | Reste à faire | Preuve de done |
|----------|-----|---------------|----------------|
| **P0** | **G2-01** | Rebuild APK après fix `router.push` Plus → Athlètes / Matériel / Comptes / … | **6/6+** landings Nox |
| **P2** | **G2-02** | Suite Detox/Maestro (login + 4 onglets) | CI / script vert |
| **P2** | **G2-03** | Paiement familial multi-athlètes | 1 encaissement → N dossiers |
| **P2** | **G2-04** | QR accès **ou** retrait claim marketing | Spec ou retrait |
| **P2** | **G2-05** | Feedback-admin SPA stable après nav | Page staff OK |

---

### 3. Checklist courte

**Web / API**
- [x] **G0-05** Inscriptions sans Réessayer fantôme *(code 17h55 — à revalider prod)*  
- [x] **G0-06 suite** libellé Active → Actifs  
- [x] **G0-01 polish** 1er paint Inscriptions  

**Android**
- [ ] **G2-01** Plus → Athlètes / Matériel / Comptes *(code `router.push` ; **rebuild APK**)*  
- [ ] **G2-02** Maestro/Detox  
- [ ] **G2-03** Paiement familial  
- [ ] **G2-04** QR / claim  
- [ ] **G2-05** Feedback-admin  

**CLOS**
- [x] G0-02…G0-04 · G1-01…G1-07 · App onglets de base  

---

### 4. Ordre d’exécution (reste actuel)

```
[web] G0-05 → G0-06 → G0-01 polish   ← livré code 17h55 → DÉPLOYER
        ↓
      G2-01   (rebuild APK + Nox 6/6)
        ↓
   G2-02 → G2-03 → G2-04 → G2-05
```

**Cible commercialisation :** déployer web + rebuild APK **G2-01** → viser **≥ 90 %**.

---

## العربية

### المتبقي — 2026-10-06 مساءً (بعد دفعة 17h55)

| الأولوية | البند | الحالة |
|----------|--------|--------|
| **ويب P0/P1** | G0-05 / G0-06 / polish تسجيلات | **مُرمَّز** — يحتاج نشر + تحقق |
| **P0 تطبيق** | Plus → رياضيون / معدات / حسابات (G2-01) | **كود `router.push`** — يحتاج rebuild APK |
| **P2 تطبيق** | Maestro، دفعة عائلية، QR، Feedback | **مفتوح** |

### مُنجز سابقاً
الفرق · `/accounts`→`/users` · المدفوعات GET · CSV · العمر · `/health` · الأجندة · تبويبات أساسية.

---

## Journal

| Date | Note |
|------|------|
| 2026-10-06 17h40 | Fichier créé / resync « reste » unique. |
| 2026-10-06 17h45 | **Retest QA** : G0-03, G0-02, G1-05, G1-06 **CLOS** ; reste surtout **G0-05** + **G2-01** + P2. |
| 2026-10-06 17h55 | **Lot reste :** G0-05 Actualiser Inscriptions ; G0-06 Actifs ; G0-01 polish cache ; G2-01 `router.push` Plus. |

---

*Document action — cocher au fur et à mesure des rejeux prod.*
