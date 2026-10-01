import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

const PLANS = [
  {
    id: "discovery",
    nameFr: "Discovery",
    nameAr: "اكتشاف",
    priceFr: "Gratuit",
    priceAr: "مجاني",
    periodFr: "14 jours d’essai",
    periodAr: "تجربة 14 يوماً",
    highlight: false,
    featuresFr: [
      "1 club · multi-sports",
      "Web admin + app parents/coachs",
      "Inscriptions, agenda, finance",
      "Sans engagement",
    ],
    featuresAr: [
      "نادي واحد · رياضات متعددة",
      "لوحة ويب + تطبيق أولياء/مدربين",
      "تسجيلات، جدول، مالية",
      "بدون التزام",
    ],
    ctaTo: "/onboard",
    ctaFr: "Démarrer l’essai",
    ctaAr: "ابدأ التجربة",
  },
  {
    id: "club",
    nameFr: "Club",
    nameAr: "نادي",
    priceFr: "20 000 DZD",
    priceAr: "20 000 دج",
    periodFr: "par an · ~1 700 DZD / mois",
    periodAr: "سنوياً · ≈ 1 700 دج / شهر",
    highlight: true,
    featuresFr: [
      "Tout Discovery, sans limite de durée",
      "Support standard (WhatsApp / email)",
      "Sauvegardes & mises à jour",
      "Idéal 1 club / 1 à plusieurs disciplines",
    ],
    featuresAr: [
      "كل مزايا الاكتشاف بلا حد زمني",
      "دعم قياسي (واتساب / بريد)",
      "نسخ احتياطي وتحديثات",
      "مثالي لنادي واحد وعدة رياضات",
    ],
    ctaTo: "/onboard",
    ctaFr: "Choisir Club",
    ctaAr: "اختر نادي",
  },
  {
    id: "premium",
    nameFr: "Academy",
    nameAr: "أكاديمية",
    priceFr: "35 000 DZD",
    priceAr: "35 000 دج",
    periodFr: "par an · support prioritaire",
    periodAr: "سنوياً · دعم أولوية",
    highlight: false,
    featuresFr: [
      "Tout Club",
      "Onboarding assisté + formation",
      "Personnalisation (couleurs, logo)",
      "Priorité support & roadmap",
    ],
    featuresAr: [
      "كل مزايا نادي",
      "إعداد بمساعدة + تكوين",
      "تخصيص (ألوان، شعار)",
      "أولوية الدعم وخارطة الطريق",
    ],
    ctaTo: "/onboard",
    ctaFr: "Demander Academy",
    ctaAr: "اطلب أكاديمية",
  },
] as const;

export function PricingPage() {
  const { lang, setLang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="pricing-page">
      <header className="pricing-hero">
        <div className="lang-switch" style={{ justifyContent: "flex-end" }}>
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
            FR
          </button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
            عربي
          </button>
        </div>
        <img src="/logo.png" alt="Nadi Connect" className="pricing-logo" />
        <p className="pricing-eyebrow">{ar ? "نادي كونكت" : "Nadi Connect"}</p>
        <h1>{ar ? "النادي المتصل" : "Le club connecté"}</h1>
        <p className="pricing-lead">
          {ar
            ? "نظام تسيير للأندية الرياضية في الجزائر — أولياء، مدربون وإدارة في منصة واحدة."
            : "Système de gestion pour clubs sportifs en Algérie — parents, coachs et direction sur une seule plateforme."}
        </p>
      </header>

      <div className="pricing-grid">
        {PLANS.map((p) => (
          <article key={p.id} className={`pricing-card${p.highlight ? " pricing-card--featured" : ""}`}>
            <h2>{ar ? p.nameAr : p.nameFr}</h2>
            <div className="pricing-amount">{ar ? p.priceAr : p.priceFr}</div>
            <div className="pricing-period">{ar ? p.periodAr : p.periodFr}</div>
            <ul>
              {(ar ? p.featuresAr : p.featuresFr).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link className={`button${p.highlight ? " accent" : ""}`} to={p.ctaTo}>
              {ar ? p.ctaAr : p.ctaFr}
            </Link>
          </article>
        ))}
      </div>

      <aside className="pricing-setup">
        <strong>{ar ? "إعداد أولي (اختياري)" : "Setup initial (optionnel)"}</strong>
        <span>
          {ar
            ? "استيراد البيانات + تكوين + إطلاق النادي ≈ 35 000 دج مرة واحدة."
            : "Import données + formation + mise en ligne ≈ 35 000 DZD one-shot."}
        </span>
      </aside>

      <aside className="pricing-setup pricing-pilot">
        <strong>{ar ? "برنامج النوادي التجريبية" : "Programme clubs pilotes"}</strong>
        <span>
          {ar
            ? "نبحث عن 2–3 أندية: تجربة 14 يوماً + مرافقة ثم اشتراك سنوي."
            : "Nous recrutons 2–3 clubs : essai 14 jours + accompagnement, puis abonnement annuel."}
        </span>
        <Link className="button accent" to="/pilote" style={{ marginInlineStart: "auto" }}>
          {ar ? "أصبح نادياً تجريبياً" : "Devenir club pilote"}
        </Link>
      </aside>

      <footer className="pricing-footer">
        <Link to="/login">{ar ? "تسجيل الدخول" : "Se connecter"}</Link>
        <Link to="/onboard">{ar ? "إنشاء نادي" : "Créer un club"}</Link>
        <Link to="/pilote">{ar ? "البرنامج التجريبي" : "Pilotes"}</Link>
      </footer>
    </div>
  );
}
