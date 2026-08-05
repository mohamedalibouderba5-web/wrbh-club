# Ordre développeur mobile — Numérotation cohérente web/API

Version cible mobile : **1.5.1** (Android `versionCode` suivant).

## Règles métier obligatoires

### 1. Numéro de ligne joueur

- Afficher `registration.list_number`, jamais `seq_no`.
- `list_number` est un rang dynamique 1…N par saison.
- Il suit l'ordre `created_at` croissant, puis `id` croissant.
- Il concerne uniquement les inscriptions non archivées.
- Après archivage/suppression du rang 3, les rangs 4 et 5 deviennent 3 et 4.
- La prochaine inscription reçoit alors le rang N+1.
- Ne jamais sauvegarder ou modifier ce rang côté mobile : il est calculé par l'API.

### 2. Numéro équipement / sac

- Utiliser uniquement `kit_number`.
- Il est indépendant de `list_number` et de la référence.
- Il reste modifiable par le manager et doit être contrôlé dans l'équipe/catégorie.

### 3. Référence immuable

- Afficher `reference` comme identité historique.
- Ne jamais construire, modifier, vider ou réutiliser une référence côté mobile.
- Une suppression/archivage conserve toujours la référence.
- Une restauration retrouve exactement la même référence.

### 4. Horodatage

- Afficher `created_at` avec date, heure, minute et seconde.
- Utiliser le fuseau local du club (`Africa/Algiers`) pour l'affichage.
- `registered_on` reste une date métier ; elle ne remplace pas `created_at`.

## Contrat API

```text
GET /api/v1/registrations
{
  "list_number": 3,
  "seq_no": 17,
  "reference": "26-27/U11/R00000042",
  "kit_number": 10,
  "created_at": "2026-08-05T18:38:12+00:00"
}
```

`seq_no` est technique/historique. L'interface doit présenter :

- **N° joueur** → `list_number`
- **N° équipement/sac** → `kit_number`
- **Référence** → `reference`
- **Créé le** → `created_at`

## Tests d'acceptation mobile

1. Créer cinq inscriptions : rangs visibles 1, 2, 3, 4, 5.
2. Archiver le rang 3.
3. Recharger : rangs visibles 1, 2, 3, 4.
4. Créer un joueur : il apparaît au rang 5.
5. Vérifier que les références des six opérations sont toutes différentes.
6. Restaurer l'ancienne inscription : sa référence initiale est conservée et les rangs redeviennent 1…6 selon l'horodatage.
7. Vérifier que changer `kit_number` ne change ni `list_number`, ni `reference`.

