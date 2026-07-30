import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Lang = "fr" | "ar";

const dict = {
  fr: {
    brand: "WRBH Club",
    manage: "Gestion du club",
    season: "Saison 2026/2027 · Football",
    wake: "Actualiser / Réveiller le serveur",
    logout: "Déconnexion",
    dashboard: "Tableau de bord",
    athletes: "Athlètes",
    registrations: "Inscriptions",
    agenda: "Agenda",
    teams: "Équipes / Coachs",
    history: "Historique",
    feedbackAdmin: "Tous les feedbacks",
    finance: "Finance",
    inventory: "Matériel",
    announcements: "Annonces",
    download: "Télécharger l'app",
    loginPhone: "Téléphone parent (ou email staff)",
    password: "Mot de passe",
    signIn: "Se connecter",
    addPlayer: "Ajouter un joueur",
    parentPhone: "N° téléphone parent",
    photo: "Photo joueur",
    capture: "Capturer",
    importPhoto: "Importer",
    status: "Statut",
    edit: "Modifier",
    save: "Enregistrer",
    cancel: "Annuler",
    categories2627: "Catégories 2026/2027 (affiche)",
    newRegistration: "Nouvelle inscription",
    newAnnouncement: "Nouvelle annonce",
    publish: "Publier",
    audienceAll: "Tous",
    sessions: "Séances",
    attendance: "Présences",
    cancelSession: "Annuler la séance",
    present: "Présent",
    absent: "Absent",
    late: "En retard",
    excused: "Excusé",
    stats: "Statistiques",
    parents: "Parents",
    active: "Actifs",
    left: "Partis",
    loading: "Chargement…",
    empty: "Aucune donnée",
    retry: "Réessayer",
    files: "Dossiers",
    pendingRegs: "Inscriptions en attente",
    overdueFees: "Retards cotisation",
    searchName: "Rechercher nom…",
    filter: "Filtrer",
    allStatuses: "Tous les statuts",
    statsGap: "Écart catégories",
    unclassified: "Hors bandes U7–U13 (actifs)",
    missingBirth: "Sans date de naissance",
    financeStaffOnly: "Données finance réservées au staff.",
    statusBreakdown: "Répartition des statuts",
    updateAvailable: "Nouvelle version de l'app disponible",
    updateNow: "Mettre à jour",
    checkUpdate: "Vérifier les mises à jour",
    checkingUpdate: "Vérification…",
    bloodType: "Groupe sanguin",
    call: "Appeler",
    filterCategory: "Filtrer par catégorie",
    allCategories: "Toutes",
    saving: "Enregistrement…",
    loadMore: "Charger plus",
  },
  ar: {
    brand: "نادي الوداد",
    manage: "تسيير النادي",
    season: "موسم 2026/2027 · كرة القدم",
    wake: "تحديث / إيقاظ الخادم",
    logout: "تسجيل الخروج",
    dashboard: "لوحة التحكم",
    athletes: "اللاعبون",
    registrations: "التسجيلات",
    agenda: "الجدول",
    teams: "الفرق / المدربون",
    history: "السجل",
    feedbackAdmin: "جميع الملاحظات",
    finance: "المالية",
    inventory: "المعدات",
    announcements: "الإعلانات",
    download: "تحميل التطبيق",
    loginPhone: "هاتف الولي (أو بريد الطاقم)",
    password: "كلمة المرور",
    signIn: "دخول",
    addPlayer: "إضافة لاعب",
    parentPhone: "رقم هاتف الولي",
    photo: "صورة اللاعب",
    capture: "التقاط",
    importPhoto: "استيراد",
    status: "الحالة",
    edit: "تعديل",
    save: "حفظ",
    cancel: "إلغاء",
    categories2627: "فئات 2026/2027 (الملصق)",
    newRegistration: "تسجيل جديد",
    newAnnouncement: "إعلان جديد",
    publish: "نشر",
    audienceAll: "الكل",
    sessions: "الحصص",
    attendance: "الحضور",
    cancelSession: "إلغاء الحصة",
    present: "حاضر",
    absent: "غائب",
    late: "متأخر",
    excused: "معذور",
    stats: "إحصائيات",
    parents: "أولياء",
    active: "نشطون",
    left: "مغادرون",
    loading: "جاري التحميل…",
    empty: "لا توجد بيانات",
    retry: "إعادة المحاولة",
    files: "الملفات",
    pendingRegs: "تسجيلات قيد الانتظار",
    overdueFees: "متأخرات الاشتراك",
    searchName: "بحث بالاسم…",
    filter: "تصفية",
    allStatuses: "كل الحالات",
    statsGap: "فجوة الفئات",
    unclassified: "خارج فئات U7–U13 (نشطون)",
    missingBirth: "بدون تاريخ ميلاد",
    financeStaffOnly: "البيانات المالية مخصصة للطاقم.",
    statusBreakdown: "توزيع الحالات",
    updateAvailable: "يتوفر تحديث جديد للتطبيق",
    updateNow: "تحديث الآن",
    checkUpdate: "التحقق من التحديثات",
    checkingUpdate: "جاري التحقق…",
    bloodType: "فصيلة الدم",
    call: "اتصال",
    filterCategory: "تصفية حسب الفئة",
    allCategories: "الكل",
    saving: "جاري الحفظ…",
    loadMore: "تحميل المزيد",
  },
} as const;

type DictKey = keyof typeof dict.fr;

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
  dir: "ltr" | "rtl";
};

const Ctx = createContext<I18nCtx | null>(null);

function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang === "ar" ? "ar" : "fr";
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("wrbh_lang") as Lang) || "fr");

  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem("wrbh_lang", l);
        setLang(l);
        applyDocumentLang(l);
      },
      t: (key) => dict[lang][key] || dict.fr[key],
      dir: lang === "ar" ? "rtl" : "ltr",
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}
