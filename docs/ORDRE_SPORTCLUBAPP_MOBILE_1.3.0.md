# ORDRE — SportClubApp / Sports Club App Ownership

**Destinataire :** discussion Cursor [Sports Club App Ownership](3783b3c7-6d4a-4399-b93d-b25c0b800219)  
**Repo :** `B:\Python\Gestion Club Sportive` · GitHub `mohamedalibouderba5-web/wrbh-club`  
**API live :** https://wrbh-api.onrender.com **v1.13.3**  
**Web live :** https://wrbh-web.onrender.com (déjà à jour)  
**Mobile actuel :** Expo `1.2.0` / `versionCode` 3 — **en retard** sur le web  

## Mission

Porter sur **l’app Android** les mises à jour récentes déjà livrées sur le site, puis publier un APK **1.3.0**.

## État actuel mobile (vérifié)

| Module | Présent | Manque vs web 1.13.3 |
|--------|---------|----------------------|
| Inscriptions | Créer, Valider, Refuser, Archiver, Restaurer | **Modifier** (`PATCH /registrations/{id}`), **Supprimer** (`DELETE`, admin/direction) |
| Athlètes | Créer, Modifier (PATCH) | **Archiver** (status Abandonne + confirm_status), **Supprimer** (`DELETE`, admin/direction), photo si possible |
| Filtre inscriptions | `confirmed` | API utilise **`approved`** — corriger le filtre |
| Équipes / coachs / historique / finance | Onglet Plus (1.2.0) | Vérifier cohérence API ; pas de refonte sauf bug |

## APIs à utiliser (déjà en prod)

- `PATCH /api/v1/registrations/{id}` — category_id, subscription_fee, full_name, birth_date, birth_place, photo_path, blood_type, parent_phone, parent_name, status, notes  
- `DELETE /api/v1/registrations/{id}` — admin/direction only  
- `POST .../archive` · `POST .../restore` — déjà branchés  
- `PATCH /api/v1/athletes/{id}` — + `confirm_status: true` pour Abandonne  
- `DELETE /api/v1/athletes/{id}` — admin/direction only  

## Livrables

1. UI mobile Inscriptions : boutons **Modifier** + **Supprimer** (confirm), formulaire d’édition  
2. UI mobile Athlètes : **Archiver** + **Supprimer** (confirm), garder Modifier  
3. Corriger filtre `approved` (pas `confirmed`)  
4. Bump `mobile/app.json` → version **1.3.0**, versionCode **4** ; `package.json` idem  
5. Build APK, release GitHub `android-v1.3.0`, mettre à jour page Download web  
6. Commit + push ; ne pas casser l’API / le web WRBH prod  

## Contraintes

- Workspace : `B:\Python\Gestion Club Sportive`  
- Ne pas committer secrets, `ereur et feedbak/`, scripts d’audit avec credentials  
- FR + AR labels courts OK  
- Tester sur Nox si dispo  

## Contexte web déjà livré (ne pas refaire côté API)

Commit `8aa772d` — edit/delete inscriptions + athlètes sur le web, déployé Render v1.13.3.
