# Reste à régler / améliorer — Nadi Connect (web + app)

**Dernière màj :** 2026-10-07 ~03h35 — code W1–W5 + A1–A3 en repo ; **deploy VPS + APK 1.18.3** encore ouverts  

**Tenant :** CS Sisi Blida (`sisi-blida-13865`)  
**Ordre actif développeur :** [`ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md`](ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md)  
**Ordre précédent :** `ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md`  
**Tableau :** [`TABLEAU_FIABILITE_MODULES_2026-10-07_FR_AR.md`](TABLEAU_FIABILITE_MODULES_2026-10-07_FR_AR.md)

**Verdict 07/10 03h :** score global **≈ 84 %** — seuil pilote A ; **pas** encore commercialisation B (≥ 90 %).

---

## Français

### Verdict rapide

| Zone | État |
|------|------|
| Web P0/P1 (ordre G0/G1) | **Presque tout CLOS** — 1 polish chargement Équipes |
| API | **OK** (payments, âge 5–55, adulte créé, health JSON) |
| Import CSV fichier | **Encore fragile** (422 multipart) |
| App **1.18.2** | Onglets + Athlètes/Inscriptions/Comptes OK · **Matériel / Historique Plus** encore NON |
| P2 vision | Familial / QR / Feedback — **ouverts** (non bloquants salon) |

---

### 0. CLOS confirmés (prod 20h00)

| ID | Item | Preuve ce soir |
|----|------|----------------|
| **G0-04** | `/accounts` → `/users` | Redirect + « Gestion des comptes » |
| **G0-05** | Inscriptions sans faux Réessayer | Bouton **Actualiser** (pas Réessayer fantôme) |
| **G0-06** | i18n filtres FR | Suspendu / Actifs / Entraînement / Payé / Dû |
| **G0-03** | Équipes web = API | Après **Actualiser** : FOOT-U7…U17 listées (API=22) |
| **G1-02** | `GET /payments` | **200** |
| **G1-05** | Âge par club | settings min=5 max=**55** ; adulte créé **200** |
| **G1-07** | `/health` web JSON | `{"status":"ok","app":"Nadi Connect"}` |
| **G1-04** | Saisons | Déjà OK |
| App tabs | Accueil / Agenda / Paiements / Plus | 1.18.1 |
| **G2-01** Historique | Plus → Historique | Land OK (audit + athlete #2633) |

---

### 1. RESTE OUVERT (court)

| Priorité | ID | Reste | Preuve de done |
|----------|-----|-------|----------------|
| **P0 léger web** | **G0-03b** | Flash « Aucune équipe » ~1–3 s (rejoué 07/10) | Zéro flash / skeleton correct |
| **P0 web** | **Historique UI** | `/history` reste « Chargement… » + **Réessayer** alors que `GET /audit` = 200 | Journal visible sans Réessayer |
| **P1** | **G1-06** | Import CSV : **aucun** path OpenAPI (rejoué 07/10) | Import `.csv` → 200 |
| **P1 web** | **Annonces fil** | UI « Aucune annonce » alors que API n=16 | Fil = API |
| **P0 léger app** | **G2-01b** | Plus → **Matériel** / **Historique** / **Annonces** : tap **NON** (Nox 11/14) | Inventaire / historique / annonces land |
| **P2** | **G2-03** | Paiement familial multi-athlètes | 1 paiement → N dossiers |
| **P2** | **G2-04** | QR ou retrait claim marketing | Spec ou retrait |
| **P2** | **G2-05** | Feedback-admin SPA | Nav stable |

---

### 2. Checklist

**Web / API**
- [x] G0-04 / G0-05 / G0-06  
- [x] G0-03 (après Actualiser)  
- [ ] **G0-03b** 1er paint équipes sans vide  
- [x] G1-02 / G1-05 / G1-07  
- [ ] **G1-06** import CSV multipart  

**Android**
- [x] G2-01 Historique (+ Athlètes/Comptes déjà OK)  
- [ ] **G2-01b** Matériel  
- [ ] G2-03 / G2-04 / G2-05  

---

### 3. Ordre d’exécution (reste réel)

```
W1 Historique web → W2 G0-03b → W3 Annonces fil → W4 G1-06 CSV
        ↓
A1 Matériel Plus → A2 Historique Plus → A3 Annonces Plus
        ↓
G2-03 → G2-04 → G2-05   ← P2 après ≥ 90 %
```

Détail tâches / checklist : [`ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md`](ORDRE_AMELIORATION_DEV_2026-10-07_FR_AR.md).

---

## العربية

### التحقق 2026-10-06 ~20:00

| | الحالة |
|--|--------|
| ويب G0/G1 | **شبه مكتمل** — فرق تظهر بعد Actualiser |
| API عمر البالغين + payments + health | **مغلق** |
| استيراد CSV ملف | **مفتوح** (422) |
| تطبيق Historique | **مغلق** |
| تطبيق Matériel | **مفتوح** |
| P2 (عائلي / QR / Feedback) | **مفتوح** |

---

## Journal

| Date | Note |
|------|------|
| 2026-10-06 17h40–18h15 | Sync reste après deploy ; G2-01b Matériel noté partiel. |
| 2026-10-06 20h00 | **Rejeu QA** : G0-03 OK après Actualiser (pas au 1er paint) ; G1-05 adulte OK ; G1-06 CSV 422 ; Nox Historique OK / Matériel NON. Fichier reste resync. |
| 2026-10-06 20h08 | **2ᵉ rejeu** : Équipes se remplissent seules après ~3 s (flash vide encore) ; CSV **422** ; Matériel app **toujours NON**. Pas 100 % réglé. |
| 2026-10-07 ~02h55 | **Rejeu % modules** : API 25/25 ; site ≈85 % ; Nox 11/14=78,6 % ; global **≈85 %**. Ouverts : G0-03b, G1-06, Historique web Réessayer, Annonces fil vide, Plus Matériel/Historique/Annonces. |

---

*Document action — cocher au fur et à mesure des rejeux prod.*

## Complément de revérification indépendante — 6 octobre 2026

**Clôture globale non confirmée.** Nouvelle exécution locale : **45 tests backend réussis sur 45**, dont les régressions NC-01 (notes) et NC-02 (historique rattaché au club). Ce résultat clôture ces régressions localement, sans constituer une preuve de déploiement ni une mesure de fiabilité globale.

**À ajouter au reste technique :** le contrôle TypeScript Android échoue encore avec TS2322 (`mobile/app/(tabs)/more.tsx:210`, propriété `delayPressIn`) et TS1323 (`mobile/src/context/AuthContext.tsx:30`, import dynamique/configuration module).

**Hydra 313, site :** une fois la liste rechargée, Amine HYDRA 0001 affiche **FOOT-U17**, cohérent avec son numéro d'inscription. Le cas NC-03 est confirmé corrigé sur le site ; l'ancienne valeur KARA-U17 restait visible pendant le chargement.

Les six lignes ouvertes ci-dessus restent ouvertes : cette passe ne les a pas toutes rejouées et n'a pas rejoué Nox. Détail et preuves : [rapport de revérification](../output/reports/audit_global_2026_10_06/Reverification_2026-10-06.md), [tests backend](../output/reports/audit_global_2026_10_06/reverification-tests.xml), [erreurs Android](../output/reports/audit_global_2026_10_06/reverification-mobile-ts.log).

**العربية:** نجحت الاختبارات المحلية 45/45 وتم تأكيد تصحيح فئة اللاعب المختبر على الموقع، لكن الإغلاق الشامل غير مؤكد. تبقى أخطاء TypeScript والبنود الستة السابقة مفتوحة حتى المعالجة وإعادة الاختبار.

## Revérification du 7 octobre 2026 — périmètre limité

Backend local : **45/45 passent** dans la nouvelle exécution. TypeScript web passe ; TypeScript Android échoue toujours sur `delayPressIn` et l'import dynamique d'AuthContext.

Site Hydra : catégorie FOOT-U17 confirmée ; équipes et coachs chargent automatiquement mais affichent encore un faux vide initial. **Nouveau point à corriger :** Finance annonce 200 échéances ouvertes alors que le tableau indique 200 affichées / 930. Les montants finissent par afficher 1 980 875 DZD restants et 117 245 DZD encaissés.

Android installé **1.18.1** : les principaux modules s'ouvrent et affichent leurs données, notamment **Accueil → Matériel**. **Plus → Matériel** reste non validé : difficultés de défilement du test Nox, sans conclusion d'échec produit. 1.18.2 est proposée mais non installée ni validée.

Feedback-admin web : navigation et chargement des entrées réussis ; cela valide ce chemin, pas tous les parcours. CSV multipart, paiement familial, QR et couverture exhaustive restent non clôturés dans cette passe.

Résultats de consultation/navigation : **web 28/30 (93,3 %), Android 20/20 (100 %), total 48/50 (96 %)**. **Ces taux ne mesurent pas la fiabilité globale.** Rapport avec dénominateurs et limites : [revérification du 7 octobre](../output/reports/audit_global_2026_10_06/Reverification_2026-10-07.md).
