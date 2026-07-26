/** Catalogue des écrans / boutons / fonctionnalités pour le feedback utilisateur. */
export type FeedbackTarget = {
  id: string;
  group: string;
  label_fr: string;
  label_ar: string;
};

export const FEEDBACK_TARGETS: FeedbackTarget[] = [
  { id: "dashboard", group: "Navigation", label_fr: "Tableau de bord", label_ar: "لوحة التحكم" },
  { id: "athletes", group: "Athlètes", label_fr: "Liste des athlètes", label_ar: "قائمة اللاعبين" },
  { id: "athletes.add", group: "Athlètes", label_fr: "Ajouter un joueur", label_ar: "إضافة لاعب" },
  { id: "athletes.edit", group: "Athlètes", label_fr: "Modifier un joueur", label_ar: "تعديل لاعب" },
  { id: "athletes.filter", group: "Athlètes", label_fr: "Filtres / recherche athlètes", label_ar: "تصفية / بحث اللاعبين" },
  { id: "athletes.sort", group: "Athlètes", label_fr: "Tri des athlètes", label_ar: "ترتيب اللاعبين" },
  { id: "athletes.photo", group: "Athlètes", label_fr: "Photo (capturer / importer)", label_ar: "الصورة (التقاط / استيراد)" },
  { id: "registrations", group: "Inscriptions", label_fr: "Liste des inscriptions", label_ar: "قائمة التسجيلات" },
  { id: "registrations.add", group: "Inscriptions", label_fr: "Nouvelle inscription", label_ar: "تسجيل جديد" },
  { id: "registrations.refs", group: "Inscriptions", label_fr: "Colonnes N° / Réf.", label_ar: "أعمدة الرقم / المرجع" },
  { id: "agenda", group: "Agenda", label_fr: "Agenda / séances", label_ar: "الجدول / الحصص" },
  { id: "agenda.create", group: "Agenda", label_fr: "Créer / modifier une séance", label_ar: "إنشاء / تعديل حصة" },
  { id: "agenda.attendance", group: "Agenda", label_fr: "Présences", label_ar: "الحضور" },
  { id: "teams", group: "Équipes", label_fr: "Équipes / Coachs", label_ar: "الفرق / المدربون" },
  { id: "finance", group: "Finance", label_fr: "Finance (général)", label_ar: "المالية (عام)" },
  { id: "finance.installments", group: "Finance", label_fr: "Cotisations / Échéances", label_ar: "الاشتراكات / الاستحقاقات" },
  { id: "finance.payments", group: "Finance", label_fr: "Paiements joueurs", label_ar: "مدفوعات اللاعبين" },
  { id: "finance.purchases", group: "Finance", label_fr: "Achats", label_ar: "المشتريات" },
  { id: "finance.ledger", group: "Finance", label_fr: "Recettes / Dépenses", label_ar: "الإيرادات / المصاريف" },
  { id: "inventory", group: "Matériel", label_fr: "Matériel / inventaire", label_ar: "العتاد / المخزون" },
  { id: "announcements", group: "Annonces", label_fr: "Annonces", label_ar: "الإعلانات" },
  { id: "download", group: "Application", label_fr: "Télécharger l'app", label_ar: "تحميل التطبيق" },
  { id: "login", group: "Compte", label_fr: "Connexion", label_ar: "تسجيل الدخول" },
  { id: "password", group: "Compte", label_fr: "Changement de mot de passe", label_ar: "تغيير كلمة المرور" },
  { id: "lang", group: "Interface", label_fr: "Langue FR / AR", label_ar: "اللغة عربية / فرنسية" },
  { id: "wake", group: "Interface", label_fr: "Réveiller le serveur", label_ar: "إيقاظ الخادم" },
  { id: "offline", group: "Interface", label_fr: "Mode hors ligne / sync", label_ar: "وضع عدم الاتصال / المزامنة" },
  { id: "other", group: "Autre", label_fr: "Autre (préciser dans le message)", label_ar: "أخرى (وضّح في الرسالة)" },
];
