# Rapport de fiabilité globale — Nadi Connect (site + Android)

**Date campagne :** 2026-10-06 (rejeu complet après-midi)  
**Produit :** Nadi Connect — https://nadi-connect.com/ · API https://api.nadi-connect.com  
**Tenant principal :** CS Sisi Blida (`sisi-blida-13865`) — essai Discovery **J-12**  
**Tenant isolation :** Elite MSA (`elite-msa-26697`)  
**App Nox :** `dz.wrbh.club` **1.17.0** (vc21) · device `127.0.0.1:62001`  
**Ordre d’amélioration :** [`ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md`](ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md)

**Preuves :**  
- Pytest : `docs/_global_pytest_2026-10-06.txt` → **43/43**  
- API : `docs/_global_fiabilite_api_2026-10-06.json` → **28/35 = 80 %**  
- Nox : `docs/_nox_global_2026-10-06/nox_parcours_result.json`  
- Navigateur Cursor : parcours humain tous modules sidebar (session Admin Sisi)

---

## Français

### 0. Vérité sur le « 100 % »

Une campagne macro + micro **ne prouve pas zéro bug**.  
**Verdict 2026-10-06 :** utilisable pour un **club jeunes** (foot/judo), **pas fiable à 100 %**, **pas prêt scale massif**.  
Failles **visibles** (Chargement…, Réessayer, i18n EN, `/accounts` vide) et **invisibles** (âge 5–17, pas d’import CSV, UI Équipes web vide alors que API = 22 équipes).

### 1. Tableau des pourcentages de fiabilité

| Domaine | Couverture | Fiabilité | Commentaire |
|---------|-----------:|----------:|-------------|
| **Backend pytest** | 43 scénarios | **100 %** | 43 passed |
| **API live métier** | 35 checks | **80 %** | 28 OK ; `GET /payments` 405 ; pas d’import ; adultes rejetés |
| **Isolation multi-tenant** | IDOR athlète | **100 %** | Elite lit Sisi → **404** |
| **Health API** | `/health` | **100 %** | `app=Nadi Connect` · version **1.18.0** |
| **Site — Dashboard** | humain | **80 %** | KPIs 371 athlètes OK ; « Réessayer » ; filtres EN (`Suspended`, `training`, `paid`) |
| **Site — Athlètes** | humain | **72 %** | Formulaire OK ; liste souvent **« Chargement… »** + Réessayer |
| **Site — Inscriptions** | humain | **55 %** | **« Catégories indisponibles »** + dossiers « Chargement… » (API catégories = 19 OK) |
| **Site — Agenda** | humain | **60 %** | Formulaire présent ; liste **« Chargement… »** ; coach = « — » seul |
| **Site — Équipes / Coachs** | humain + API | **40 %** | UI : **« Aucune équipe »** alors que API **22 équipes** et app Nox les affiche — **faille critique UI** |
| **Site — Comptes `/users`** | humain | **88 %** | Formulaire création OK ; API 284 users |
| **Site — alias `/accounts`** | humain | **10 %** | Page **vide** (0 éléments) — pas de redirect |
| **Site — Finance** | humain | **75 %** | Tarifs 800/1500/4000 OK ; onglets + « Chargement… » prolongé |
| **Site — Matériel / Annonces** | API | **90 %** | GET 200 |
| **Site — Guide / Download** | public | **92 %** | Pages 200 ; APK 1.17.0 aligné Nox |
| **Site — i18n filtres** | dashboard | **55 %** | EN brut dans UI FR |
| **Android — Accueil** | Nox | **92 %** | Marque Nadi Connect + club ; Discovery J-12 |
| **Android — Agenda** | Nox | **90 %** | Séances + coachs visibles |
| **Android — Paiements** | Nox | **90 %** | 882 échéances · 902 000 DZD reste |
| **Android — Messages** | Nox | **88 %** | Annonces listées |
| **Android — Plus / menus** | Nox | **70 %** | Inscriptions/Équipes/Comptes OK ; **Athlètes reste sur Plus** ; Matériel/Historique non ouverts |
| **Android — QR / RFID / offline** | code + audit | **10 %** | Absents |
| **Métier adultes / CSV** | API | **30 %** | Âge 5–17 ; import 404/405 |
| **SCORE GLOBAL PONDÉRÉ** | campagne | **72 %** | §2 |
| **Score club jeunes (hors QR/adultes)** | même | **78 %** | — |
| **Score « scale massif zéro faille »** | même | **55 %** | Chargements + Équipes web + i18n |

### 2. Pondération (72 %)

| Poids | Zone | Note | Contribution |
|------:|------|-----:|-------------:|
| 25 % | Pytest + isolation | 100 | 25,0 |
| 20 % | API live | 80 | 16,0 |
| 30 % | Site humain | 62 | 18,6 |
| 20 % | Android Nox | 82 | 16,4 |
| 5 % | Absents (QR/CSV/adultes) | 25 | 1,3 |
| | Sous-total | | **77,3** |
| | **Pénalités S1** (Inscriptions, Équipes web vides, `/accounts`) | | **−5,3** |
| | **TOTAL** | | **≈ 72 %** |

### 3. Macro-tests (modules)

| Module | Site | Android Nox | Statut |
|--------|:----:|:-----------:|--------|
| Login + Discovery | OK (session) | OK | Vert |
| Dashboard | OK* | Accueil OK | *Réessayer / EN |
| Athlètes | Partiel | Tap Plus fragile | Charge |
| Inscriptions | **FAIL charge** | OK (liste) | Site S1 |
| Agenda | Partiel | **OK** | Site charge |
| Équipes | **FAIL UI vide** | **OK** | Écart site/API |
| Comptes | OK `/users` | OK | `/accounts` mort |
| Finance / Paiements | Partiel | OK | — |
| Matériel | API OK | Non ouvert | Nav Plus |
| Messages / Annonces | — | OK | — |
| Historique | — | Non ouvert | — |
| Guide / APK | OK | 1.17.0 | Vert |

### 4. Micro-tests & failles

#### Visibles
1. Bouton **« Réessayer »** dashboard / athlètes / inscriptions.  
2. Inscriptions : **« Catégories indisponibles »** malgré API 19 catégories.  
3. Agenda / Athlètes / Finance : **« Chargement… »** prolongé.  
4. Équipes web : **« Aucune équipe »** vs API 22 / app OK.  
5. Filtres EN : `Suspended`, `Active`, `training`, `paid`, `due`.  
6. Date : label `jj/mm/aaaa` vs contrôle `mm/dd/yyyy`.  
7. Route **`/accounts`** page blanche.  
8. Alerte **449 docs à renouveler** / 338 licences &lt; 30 j (bruit).  
9. Android Plus : tap **Athlètes** / **Matériel** / **Historique** peu fiable.

#### Invisibles
1. Âge athlète **5–17** global → fitness/adultes impossibles.  
2. **Pas d’import CSV** (`404`/`405`).  
3. `GET /payments` = **405** (utiliser `/payments/recent`).  
4. `POST /seasons` = **200** (corrigé vs audits antérieurs — OK aujourd’hui).  
5. Paiement familial multi-athlètes non atomique.  
6. Pas de suite Detox/Maestro.  
7. Health web `/health` renvoie le **HTML SPA** (pas JSON) — monitoring trompeur.

### 5. Bilan SaaS

| Question | Réponse |
|----------|---------|
| Prêt déploiement massif ? | **NON** |
| Prêt club jeunes structuré (démo / essai) ? | **OUI avec réserves** (recette manuelle Inscriptions + Équipes web) |
| Score global | **72 %** |
| Prochaine cible | **≥ 90 %** via ordre G0/G1 |

---

## العربية

### النتيجة
- Pytest: **43/43 = 100٪**  
- API مباشرة: **80٪**  
- الموقع (إنسان): مشاكل تحميل + فرق «Aucune équipe» رغم 22 فريقًا في API  
- أندرويد Nox 1.17.0: Accueil/Agenda/Paiements جيدة؛ قائمة Plus غير موثوقة لبعض الشاشات  
- **الدرجة الإجمالية: 72٪** — جاهز لنادي ناشئين مع تحفظات، **غير جاهز** لنشر ضخم بلا إصلاحات P0  

### أمر التحسين
انظر [`ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md`](ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md).

---

## Journal campagne

| Heure (UTC+1) | Action |
|---------------|--------|
| 2026-10-06 ~14h45 | Rejeu global : browser Cursor + Nox ADB `62001` + API script + pytest 43 |
| | Confirmé : POST `/seasons` OK ; Équipes web vides (S1) ; Inscriptions catégories KO UI |
