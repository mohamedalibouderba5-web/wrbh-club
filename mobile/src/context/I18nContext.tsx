import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nManager } from "react-native";

export type Lang = "fr" | "ar";

const STORAGE_KEY = "nadi.lang";

const dict = {
  fr: {
    hello: "Salam",
    children: "Enfants",
    sessions: "Séances",
    convocations: "Convocations",
    unpaid: "Impayés",
    toFollow: "À suivre",
    agenda: "Agenda",
    payments: "Paiements",
    messages: "Messages",
    more: "Plus ☰",
    moreTitle: "Plus",
    moreHint: "Athlètes, inscriptions, équipes, finance, matériel et historique sont ici.",
    planning: "Planning (30 jours)",
    notifications: "Notifications",
    announcements: "Annonces",
    noEvents: "Aucun événement à venir",
    noNotifs: "Aucune notification récente",
    noAnnouncements: "Aucune annonce récente",
    noChildren: "Aucun enfant lié — contactez le club",
    refresh: "Actualiser / Réveiller le serveur",
    parentalPrefs: "Préférences suivi parental",
    newSession: "+ Nouvelle séance",
    closeForm: "Fermer le formulaire",
    createSession: "Créer une séance",
    createSessionBtn: "Créer la séance",
    saving: "Enregistrement…",
    language: "Langue",
    langFr: "Français",
    langAr: "العربية",
    home: "Accueil",
    athletes: "Athlètes",
    registrations: "Inscriptions",
    teams: "Équipes / Coachs",
    users: "Comptes",
    inventory: "Matériel",
    history: "Historique",
    feedback: "Feedback",
    profile: "Profil",
    pricing: "Offres / Tarifs",
    guide: "Guide / Formation",
    platform: "Plateforme",
    add: "+ Ajouter",
    searchAthletes: "Rechercher nom, catégorie, téléphone…",
    renewFilter: "À renouveler (< 30 j)",
    signIn: "Se connecter",
    password: "Mot de passe",
    clubCode: "Code club",
    loginPhone: "Téléphone parent (ou email staff)",
    wake: "Réveiller le serveur",
    createAccount: "Créer un club (essai)",
    cancel: "Annuler",
    save: "Enregistrer",
  },
  ar: {
    hello: "سلام",
    children: "الأطفال",
    sessions: "الحصص",
    convocations: "الاستدعاءات",
    unpaid: "غير المدفوع",
    toFollow: "للمتابعة",
    agenda: "الجدول",
    payments: "المدفوعات",
    messages: "الرسائل",
    more: "المزيد ☰",
    moreTitle: "المزيد",
    moreHint: "اللاعبون والتسجيلات والفرق والمالية والمعدات والسجل هنا.",
    planning: "برنامج الشهر",
    notifications: "الإشعارات",
    announcements: "الإعلانات",
    noEvents: "لا أحداث قادمة",
    noNotifs: "لا إشعارات حديثة",
    noAnnouncements: "لا إعلانات حديثة",
    noChildren: "لا طفل مرتبط — اتصلوا بالنادي",
    refresh: "تحديث / إيقاظ الخادم",
    parentalPrefs: "تفضيلات المتابعة الأبوية",
    newSession: "+ حصة جديدة",
    closeForm: "إغلاق النموذج",
    createSession: "إنشاء حصة",
    createSessionBtn: "إنشاء الحصة",
    saving: "جاري الحفظ…",
    language: "اللغة",
    langFr: "Français",
    langAr: "العربية",
    home: "الرئيسية",
    athletes: "اللاعبون",
    registrations: "التسجيلات",
    teams: "الفرق / المدربون",
    users: "الحسابات",
    inventory: "المعدات",
    history: "السجل",
    feedback: "ملاحظات",
    profile: "الملف",
    pricing: "العروض",
    guide: "الدليل / التكوين",
    platform: "المنصة",
    add: "+ إضافة",
    searchAthletes: "بحث بالاسم أو الفئة أو الهاتف…",
    renewFilter: "للتجديد (< 30 يوماً)",
    signIn: "دخول",
    password: "كلمة المرور",
    clubCode: "رمز النادي",
    loginPhone: "هاتف الولي (أو بريد الطاقم)",
    wake: "إيقاظ الخادم",
    createAccount: "إنشاء نادٍ (تجربة)",
    cancel: "إلغاء",
    save: "حفظ",
  },
} as const;

type Key = keyof typeof dict.fr;

type I18nValue = {
  lang: Lang;
  t: (key: Key) => string;
  setLang: (lang: Lang) => void;
  isRtl: boolean;
};

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "ar" || v === "fr") setLangState(v);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
    const rtl = next === "ar";
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      isRtl: lang === "ar",
      t: (key) => dict[lang][key] || dict.fr[key] || key,
      setLang,
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) {
    return {
      lang: "fr",
      isRtl: false,
      t: (key) => dict.fr[key] || key,
      setLang: () => undefined,
    };
  }
  return v;
}
