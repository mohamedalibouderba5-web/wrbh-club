# Interfaces par rôle — partage Nadi Connect (FR + AR)

Date : 2026-10-05 · Source : `MATRICE_ROLES_ACCES.md` + `web/src/roles/access.ts`

## Français — que voit / que fait chaque compte

### Parent
- **Accueil** : enfants liés, séances à venir, convocations, impayés, notifications, préférences.
- **Menu** : Accueil · Inscriptions · Agenda · Annonces · Guide · App.
- **Fait** : consulter, répondre aux convocations, inscrire / suivre ses dossiers.
- **Ne fait pas** : créer séance, pointer présences, finance club, comptes, corbeille, publier annonces.

### Coach
- **Accueil** : équipes assignées, séances du jour / à venir, raccourcis Agenda / Présences.
- **Menu** : Accueil · Athlètes · Agenda · Équipes · Annonces · Guide · App.
- **Fait** : séances de ses équipes, présences, annulation séance.
- **Ne fait pas** : Finance, Comptes, Historique/Corbeille, Matériel écriture, publier annonces, créer structure équipes.

### Staff
- **Accueil** : tableaux de bord analytics club.
- **Menu** : ops (Athlètes, Inscriptions, Agenda, Équipes, Finance, Matériel, Historique…) **sans** Comptes ni Feedback admin.
- **Fait** : opérations quotidiennes ; **pas** créer comptes admin/direction.

### Direction
- Comme staff **+** Comptes + Feedback admin + validation séances parents.

### Admin club
- Complet côté club (hors console plateforme multi-clubs).

### Super-admin plateforme
- `/platform` uniquement pour KPI multi-clubs / suspension — pas un rôle club.

---

## العربية — ماذا يرى / ماذا يفعل كل حساب

### ولي الأمر (parent)
- **الرئيسية**: الأبناء، الحصص، الدعوات، المستحقات، الإشعارات.
- **القائمة**: رئيسية · تسجيلات · أجندة · إعلانات · دليل · تطبيق.
- **يفعل**: مشاهدة، الرد على الدعوات، تسجيل أبنائه.
- **لا يفعل**: إنشاء حصة، الحضور، مالية النادي، الحسابات، سلة المهملات.

### المدرب (coach)
- **الرئيسية**: فرقه وحصصه وروابط الأجندة/الحضور.
- **يفعل**: حصص فرقه + الحضور.
- **لا يفعل**: المالية، الحسابات، الأرشيف العام، نشر الإعلانات.

### موظف / إدارة / مسؤول
- حسب المصفوفة: الموظف للعمليات اليومية؛ الإدارة + الحسابات؛ المسؤول كامل النادي؛ مشرف المنصة للأندية كلها.
