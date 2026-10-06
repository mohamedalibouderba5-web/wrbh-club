# Repère court — Que régler ? Quand commercialiser ?

**Date :** 2026-10-06  
**Note actuelle :** **~72–74 %** (campagne globale)  
**Ordre dév détaillé :** [`ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md`](ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md)  
**Rapport long :** [`RAPPORT_FIABILITE_GLOBALE_2026-10-06_FR_AR.md`](RAPPORT_FIABILITE_GLOBALE_2026-10-06_FR_AR.md)

---

## Français

### On a vraiment amélioré ?

**Oui.** Pytest **43/43**, isolation multi-tenant OK, essai 14 j, finance/paiements, app **1.17.0** sur Nox (login, agenda, paiements, notifs). Ce n’est plus un prototype vide.  
**Mais** 74 % ≠ prêt vente sans réserve : des écrans staff **cassent la confiance** (chargements, équipes vides, « Réessayer »).

### Quoi régler **maintenant** (donner ça au développeur IA)

Exécuter **uniquement** l’ordre `ORDRE_AMELIORATION_GLOBALE_2026-10-06` dans cet ordre :

1. **G0-01** Inscriptions stables (plus de « catégories indisponibles »)  
2. **G0-02** Agenda : séances + coachs visibles vite  
3. **G0-03** Équipes web = API (plus « Aucune équipe » si 22 équipes)  
4. **G0-04** `/accounts` → `/users`  
5. **G0-05** Plus de « Réessayer » fantôme  
6. **G0-06** Filtres dashboard en français (pas `Suspended` / `paid`)  

Puis P1 utiles vente : dates `jj/mm/aaaa`, âge par club (si clients salles), import CSV.  
Android : **G2-01** navigation Plus → Athlètes / Matériel / Comptes.

### Point de commercialisation (seuils clairs)

| Seuil | Note cible | On peut dire… |
|------:|-----------:|---------------|
| **A — Pilote payant limité** | **≥ 85 %** + **tout G0 clos** | « On vend à 3–10 clubs jeunes (foot/judo), avec accompagnement » |
| **B — Commercialisation ouverte (offre Discovery / clubs jeunes)** | **≥ 90 %** + G0 + G1-01/02/03 + Nox 6/6 | « Produit commercialisable pour académies / clubs structurés 5–17 ans » |
| **C — Scale / marketing large** | **≥ 95 %** + G1-05/06 + promesse QR retirée ou livrée | « On scale ads / salons sans filet » |

**Point officiel recommandé aujourd’hui :** viser **seuil B (≥ 90 %)** avant d’annoncer « on commercialise ».  
Avant ça : seulement **pilotes contrôlés** (seuil A), pas campagne grand public.

### Message à coller au développeur IA

> Exécute `docs/ORDRE_AMELIORATION_GLOBALE_2026-10-06_FR_AR.md` lot **G0-01 → G0-06** d’abord (site = vérité).  
> DoD : Inscriptions/Agenda/Équipes sans Chargement/Réessayer fantôme ; `/accounts`→`/users` ; i18n filtres FR.  
> Puis mets à jour §15 `ORDRE_LOGICIEL_MAITRE` + journal Android.  
> Objectif note : **≥ 90 %** = feu vert commercialisation clubs jeunes.

---

## العربية

### هل تحسّن النظام؟
**نعم** (اختبارات، عزل النوادي، تجربة 14 يوماً، تطبيق 1.17.0).  
**لكن 74% ليست جاهزية بيع بلا تحفظ.**

### ماذا نصلح الآن؟
تنفيذ أمر التحسين **G0-01→G0-06** ثم P1 الضرورية، وأندرويد G2-01.

### متى نُسوّق؟
| العتبة | النسبة | المعنى |
|--------|--------|--------|
| أ — تجريبي مدفوع محدود | ≥ 85% + إغلاق G0 | 3–10 نوادٍ مع مرافقة |
| **ب — تسويق مفتوح (ناشئين)** | **≥ 90%** | **العتبة الموصى بها للبيع** |
| ج — توسّع إعلاني | ≥ 95% | إعلانات/معارض بلا شبكة أمان |

**الرسالة للمطوّر:** نفّذ أمر 2026-10-06 (G0 أولاً) حتى **≥ 90%** قبل إعلان التسويق العام.
