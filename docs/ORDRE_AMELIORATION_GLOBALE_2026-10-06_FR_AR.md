# Ordre d’amélioration globale — Nadi Connect

**Date :** 2026-10-06  
**Source :** campagne fiabilité — [`RAPPORT_FIABILITE_GLOBALE_2026-10-06_FR_AR.md`](RAPPORT_FIABILITE_GLOBALE_2026-10-06_FR_AR.md)  
**Vérification indépendante :** [`VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md`](VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md) — **soir 2026-10-06**  
**Score fiabilité (dernière campagne) :** **72 %** · réalisation réelle de cet ordre ≈ **15–25 %**  
**Règle :** site = source de vérité · **ne cocher FAIT que si preuve prod** · §15 maître + journal app

---

## Français

### Priorité P0 (bloquant)

| ID | Action | Statut **vérifié prod** | Preuve |
|----|--------|-------------------------|--------|
| **G0-01** | Stabiliser Inscriptions | **PARTIEL** | Catégories OK ; dossiers « Chargement… » + Réessayer |
| **G0-02** | Agenda + coachs | **PARTIEL** | API coach_name OK ; UI à revalider post-deploy |
| **G0-03** | Équipes web = API | **NON** | UI « Aucune équipe » / API 22 |
| **G0-04** | `/accounts` → `/users` | **NON** | Page blanche sur `/accounts` |
| **G0-05** | Faux « Réessayer » | **NON** | Toujours visible dashboard / inscriptions |
| **G0-06** | i18n filtres FR/AR | **NON** | `Suspended`, `training`, `paid` encore EN |

### Priorité P1

| ID | Action | Statut **vérifié prod** | Preuve |
|----|--------|-------------------------|--------|
| **G1-01** | Date `jj/mm/aaaa` | **PARTIEL** | Label + `lang=fr-DZ` code |
| **G1-02** | Alias `GET /payments` | **NON** | **405** en prod (code local non déployé) |
| **G1-03** | Bruit licences | **NON** | Toujours 338 licences &lt; 30 j |
| **G1-04** | `POST /seasons` | **FAIT** | 200 OK |
| **G1-05** | Âge par club | **NON** | Settings sans min/max ; adulte 400 |
| **G1-06** | Import CSV | **NON** | `/athletes/import` **405** |
| **G1-07** | `/health` web JSON | **NON** | HTML SPA |

### Priorité P2

| ID | Action | Statut **vérifié prod** |
|----|--------|-------------------------|
| **G2-01** | Nav Plus Android | **NON** |
| **G2-02** | Detox/Maestro | **NON** |
| **G2-03** | Paiement familial | **NON** |
| **G2-04** | QR / retrait claim | **NON** |
| **G2-05** | Feedback-admin SPA | **NON** |

### Ordre d’exécution (reste ouvert)

```
G0-03 → G0-04 → G0-05 → G0-06 → (finir G0-01/02)
        ↓
DEPLOY API+web (G1-02, G1-05, G1-06, G1-07, G1-03)
        ↓
G1-01 → G2-01 → G2-02 → G2-03 → G2-04 → G2-05
```

### Note déploiement

Beaucoup de correctifs sont dans le **repo local** mais absents de la prod (`git_sha=ui-density`).  
**Prochaine étape obligatoire :** déployer puis rejouer `VERIF_ORDRE_AMELIORATION_*.md`.

---

## العربية

### التحقق (مساء 2026-10-06)

| | |
|--|--|
| منجز في الإنتاج | أساسًا **G1-04** |
| جزئي | G0-01، G0-02، G1-01 |
| غير منجز | باقي G0 + معظم G1 + كل G2 |
| نسبة إنجاز الأمر | **≈ 15–25٪** |

التفاصيل: [`VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md`](VERIF_ORDRE_AMELIORATION_2026-10-06_FR_AR.md).
