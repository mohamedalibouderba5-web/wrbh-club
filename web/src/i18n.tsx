import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
    save: "Enregistrer",
    categories2627: "Catégories 2026/2027 (affiche)",
    newRegistration: "Nouvelle inscription",
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
    save: "حفظ",
    categories2627: "فئات 2026/2027 (الملصق)",
    newRegistration: "تسجيل جديد",
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("wrbh_lang") as Lang) || "fr");
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem("wrbh_lang", l);
        setLang(l);
        document.documentElement.lang = l;
        document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
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
