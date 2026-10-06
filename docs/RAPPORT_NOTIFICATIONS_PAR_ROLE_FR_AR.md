# Notifications par type de compte — tableau simplifié

**Produit :** Nadi Connect  
**Date :** 2026-10-06  
**Site :** cloche Chrome + son (`NotificationBell`) · API `broadcast.py`  
**App :** ordre **§9quinquies** livré en **1.17.0** (`NotificationBell`, dashboards Accueil, push)

---

## Français

### Qui reçoit quoi ?

| Type de compte | Reçoit (notifications) | Ne reçoit pas (en principe) |
|----------------|------------------------|-----------------------------|
| **Admin / Direction** (gérant) | **Tout** : séances (création, démarrage, fin, annulation), inscriptions, encaissements, dépenses, achats matériel, messages parents, rappels salaires coach | — |
| **Staff / comptable** | Finance (encaissements + dépenses), inscriptions, matériel / stock | Messages purement parent↔coach (sauf si aussi staff) |
| **Coach** | Séances créées / annulées (ses équipes), messages / commentaires parents, rappel date proche paiement coach (salaire) | Finance club générale, comptes utilisateurs, corbeille globale |
| **Parent** | Séances enfants (création, rappel, début, fin, retard, absence, annulation), paiement enregistré, **solde cotisations** (tarif mensuel + reste ≈ mois), préférences réglables | Création séance, dépenses club, achats stock club, comptes admin |
| **Super-admin plateforme** | Console multi-clubs (hors hub club) | Notifications métier d’un club précis (sauf compte club) |

### Légende kinds (technique)

| Kind API | Sens |
|----------|------|
| `session_create` / `session_start` / `session_end` / `cancel` / `attendance` / `reminder` | Cycle séance |
| `payment_parent` / `payment_balance` | Paiement + reste cotisations |
| `finance_income` / `finance_expense` | Caisse |
| `registration` | Inscription |
| `inventory` / `inventory_purchase` | Matériel |
| `parent_message` | Message parent → staff/coach |
| `coach_payroll` | Rappel salaire coach |

### Solde parent (exemple métier)

Si paiement **4000 DZD** dont assurance + équipement déjà imputés, le système calcule le **reste** sur les échéances mensuelles (ex. **800 DZD**/mois) et notifie le parent (`payment_balance` ≈ nombre de mois restants).

---

## العربية

### من يستلم ماذا؟

| نوع الحساب | يستلم | لا يستلم (عادة) |
|------------|--------|------------------|
| **مسؤول / إدارة** | **كل شيء**: الحصص، التسجيلات، التحصيل، المصاريف، العتاد، رسائل الأولياء، تذكير أجور المدربين | — |
| **موظف / محاسبة** | المالية (دخل+مصروف)، التسجيلات، العتاد | رسائل ولي↔مدرب فقط |
| **مدرب** | حصص فرقه (إنشاء/إلغاء)، رسائل الأولياء، تذكير أجره | مالية النادي العامة، الحسابات، سلة المهملات |
| **ولي الأمر** | حصص الأبناء (إنشاء، تذكير، بداية، نهاية، تأخير، غياب، إلغاء)، دفع مسجّل، **رصيد الاشتراك** (شهري + المتبقي ≈ أشهر) | إنشاء حصة، مصاريف النادي، مخزون النادي |
| **مشرف المنصة** | لوحة الأندية المتعددة | إشعارات نادٍ معيّن (إلا بحساب نادٍ) |

### ملاحظة

الموقع جاهز (جرس Chrome + صوت). التطبيق: **§9quinquies** مُسلَّم في APK **1.17.0**.
