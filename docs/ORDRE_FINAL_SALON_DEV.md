# Ordres finalisés — Salon FormaTech (VPS uniquement)

**Date :** 2026-10-01, **19h00**  
**Hébergement :** VPS `http://46.224.38.201:8080` (web) · `:8081` (API)  
**Règle absolue :** **pas de domaine** → **ne pas** demander HTTPS / DNS / certificat.  
**Hors scope salon :** mode hors-ligne + sync locale, Play Store, Chargily, APK offline.

Les **gros correctifs code** (cloisonnement, inscriptions, arabe, ClubLock, APK 1.10.0, démo) sont **faits**.  
Ce document = **ce qu’il reste à régler** avec chaque développeur.

---

## A. Développeur **Android**

**Ordre actif :** [`docs/ORDRE_APP_ANDROID.md`](ORDRE_APP_ANDROID.md)  
**État code :** **terminé** pour le salon (1.10.0 publié).

### À faire maintenant (obligatoire)

| # | Tâche | Comment prouver |
|---|--------|-----------------|
| **A-1** | Installer l’APK **1.10.0** depuis `/download` (pas un vieux USB) | Version affichée = 1.10.0 |
| **A-2** | Compte **staff** : créer une **inscription** avec téléphone parent | Succès, pas d’erreur brute |
| **A-3** | Compte **parent** club A : ne voit **que** ses enfants (pas club B) | Note / capture |
| **A-4** | **Notifications** : une notif club A n’apparaît pas chez club B | Note / capture |

### Interdit / plus tard

- Domaine, HTTPS, cleartext  
- Base locale hors-ligne + sync  
- i18n de **toute** l’app (Accueil+Agenda déjà faits)  
- Play Store  

### Livrable

Une ligne dans le journal `ORDRE_DEV_APP_ANDROID.md` §9 :  
`Recettes A-2 A-3 A-4 OK sur 1.10.0 — date — téléphone`

---

## B. Développeur **web / API** (site)

**Ordre actif :** [`docs/ORDRE_CORRECTIFS_PRE_SALON.md`](ORDRE_CORRECTIFS_PRE_SALON.md) + ce fichier  
**État code salon :** **terminé** (hors domaine).

### À faire maintenant (obligatoire)

| # | Tâche | Comment prouver |
|---|--------|-----------------|
| **W-1** | Parcours **10 min** sur un club `demo-*-safex` : login → inscription → athlète → séance → notif → paiement / licence | ✅ **2026-10-01 19h10** — `demo-foot-safex` UI + REG 378 + Finance |
| **W-2** | Vérifier que les **4 clubs démo** se connectent (slugs + mots de passe démo) | ✅ **4/4** `DemoClub!2026` |
| **W-3** | Reset démo si besoin (`seed_demo`) entre essais | ✅ `docker exec -i wrbh-api python -c "from scripts.seed_demo import run; run()"` |

### Optionnel (si temps, pas bloquant stand)

| # | Tâche | Notes |
|---|--------|--------|
| **W-4** | `PATCH /admin/clubs/{id}` + bouton Suspendre sur `/platform` | ✅ code (déployer avec cette passe) |

### Interdit / plus tard

- Acheter / brancher un **domaine**  
- HTTPS / Caddy TLS  
- Mode hors-ligne navigateur  
- Chargily / facturation en ligne  

### Livrable

Une ligne dans `ORDRE_LOGICIEL_MAITRE.md` §15 :  
`Recette W-1 OK sur VPS — date — club demo-…`

---

## C. Synthèse « que reste-t-il ? »

| Rôle | Code salon | Reste |
|------|------------|--------|
| **Android** | Fait (1.10.0) | **4 recettes téléphone** (A-1…A-4) |
| **Web / API** | Fait | **1 parcours stand** + comptes démo prêts (W-1…W-3) ; W-4 optionnel |
| **Les deux** | — | **Ne pas** toucher au domaine |

Quand A-2…A-4 et W-1 sont cochés → **prêt stand prouvé** passe de ~67 % à ~**100 %** (sur barème VPS sans HTTPS).

---

## D. Ordres déjà émis (historique)

| Document | Destinataire | Statut |
|----------|--------------|--------|
| `ORDRE_CORRECTIFS_PRE_SALON.md` | Site / API | Émis ; code Lots A/C salon **appliqué** |
| `ORDRE_APP_ANDROID.md` | Android | Émis 16h20 ; code **appliqué** en 1.10.0 |
| `ORDRE_DEV_APP_ANDROID.md` | Android (sync site) | Journal à jour |
| `RESTE_A_FAIRE_PAR_ROLE.md` | Les deux | Tableau d’avancement |
| **Ce fichier** | Les deux | **Ordre final salon = recettes + garde-fous** |

**Oui : les ordres de développement sont finalisés.**  
Il ne reste plus à « inventer » des features salon : il reste à **prouver** que ça marche sur le VPS (site + téléphone).
