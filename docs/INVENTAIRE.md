# Inventaire scanné — WRBH Club Sportif

**Date scan :** 2026-07-22  
**Source workspace :** `B:\Python\Gestion Club Sportive` (pas de sous-dossier séparé — assets à la racine)

## Fichiers trouvés

| Fichier | Type | Usage |
|---------|------|--------|
| `525687384_…_n.jpg` | Logo circulaire | Branding officiel → `assets/logo-wrbh.png` |
| `745523806_…_n.jpg` | Affiche inscriptions | Saison 2026/2027, catégories, contacts → `assets/affiche-inscription-2026.jpg` |
| `gestion description joueur WRHB 1.3 (1).xlsm` | Excel macro | Gestion historique joueurs / coachs / cotisations / transport |

**Aucun autre document PDF/Word** trouvé dans le workspace.

## Identité club (extrait)

- **Nom FR :** Widad Riadi Baladiat Hammadi / Hammedi
- **Nom AR :** الوداد الرياضي لبلدية حمادي
- **Sigle :** WRBH (logo) / WRHB (nom fichier Excel)
- **Couleurs :** bleu royal `#1E3A8A` / `#2B4596`, jaune `#F6E041` / `#F5C518`, blanc
- **Discipline :** Football (école de foot / catégories jeunes)
- **Téléphone / WhatsApp :** 0540 344884 (+213)
- **Lieu inscriptions (affiche) :** Mazhoud Foot — Hammadi, face école Saray Hussein, route stade 01 Novembre 1954
- **Réseaux :** Facebook / Instagram « الوداد الرياضي لبلدية حمادي »

## Feuilles Excel (7)

1. **Formulaire d'inscription** — saisie joueur + droits d’abonnement + mois (Sep→Août)
2. **Langues** — messages UI FR/AR (erreurs, confirmations)
3. **registre joueur** — ~114 joueurs Active (n°, nom, naissance, lieu, date inscription, catégorie, cotisations mensuelles, Total, Active)
4. **Entraineur** — 5 coachs, droits coach (5000 DZD) + paiements mensuels, totaux ~84k–96k DZD
5. **الفئه** — pivot par catégorie U13/U11/U9/U7 + sommes cotisations
6. **النقل** — dépenses transport (chauffeur, montant, date, lieu) — 20 trajets
7. **parametre** — mapping catégorie ↔ années de naissance + formule auto-catégorie

## Catégories (paramètre Excel — saison courante fichier)

| Catégorie | Années naissance |
|-----------|------------------|
| U14 | 2011–2012 |
| U13 | 2013–2014 |
| U11 | 2015–2016 |
| U9 | 2017–2018 |
| U7 | 2019–2020 |
| U6 | 2021–2022 |

**Affiche 2026/2027** (à appliquer pour nouvelle saison) :

| Catégorie | Années |
|-----------|--------|
| U13 | 2014/2015 |
| U11 | 2016/2017 |
| U9 | 2018/2019 |
| U7 | 2020/2021 |

Effectifs Excel : U13=45, U11=26, U9=20, U7=11, U14=6, U6=3, N/A=3.

## Coachs (Excel)

| # | Nom | Groupe | Droit coach | Total paie |
|---|-----|--------|-------------|------------|
| 1 | موزاوي مروان | u13 1 | 5000 | 89000 |
| 2 | سعيدي عمر | u9 | 5000 | 92000 |
| 3 | علوي عبد الرحمان | u11 | 5000 | 96000 |
| 4 | علوي اسامة | u7 | 5000 | 84000 |
| 5 | شراق سيدعلي | u13 2 | 5000 | 86000 |

→ Deux groupes U13 (u13 1 / u13 2) dans Excel.

## Finance observée

- Devise implicite : **DZD**
- **حقوق الاشتراك** (droit d’inscription / cotisation) : montants typiques **4000**, parfois **5500**, **2000**, **12000** (feuille catégories)
- Paiements mensuels colonnes : سبتمبر… جويلية (+ أوت dans formulaire)
- Paie coachs : forfait initial + montants mensuels variables (~5k–11k/mois)
- Dépenses **النقل** : bus/trajets matchs (3000–16000 DZD)

## Ambiguïtés à confirmer (non inventées)

1. **حقوق الاشتراك** = frais unique d’inscription saison, ou cotisation annuelle totale ?
2. Colonnes mois = échéances mensuelles séparées, ou suivi des versements du droit d’abonnement ?
3. Affiche 2026/27 n’inclut pas U14/U6 — conserver dans le système comme catégories optionnelles ?
4. Orthographe Hammadi vs Hammedi — quelle forme officielle ?
5. Montants cotisations 2026/27 non indiqués sur l’affiche — tarifs à saisir en admin ?

## Décisions scaffolding (provisoires, modifiables)

- Garder **toutes** les catégories Excel + poster comme seed saison 2025/26 et 2026/27
- Modéliser cotisation = **plan d’échéances** (inscription + mensuels) — compatible Excel
- Transport = type de **dépense** club
- Paie coach = type **forfait + mensuel** (pas d’horaire/match dans Excel → champs optionnels pour extension)
