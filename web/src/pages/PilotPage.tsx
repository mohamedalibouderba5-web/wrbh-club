import { Link } from "react-router-dom";
import { DEMO_CLUB_SLUG } from "../config";
import { useI18n } from "../i18n";

/** Page programme pilotes — vente assistée 2–3 clubs. */
export function PilotPage() {
  const { lang, setLang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="pilot-page" dir={ar ? "rtl" : "ltr"}>
      <header className="pilot-hero">
        <div className="lang-switch" style={{ justifyContent: "flex-end" }}>
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
            FR
          </button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
            عربي
          </button>
        </div>
        <img src="/logo.png" alt="Nadi Connect" className="pricing-logo" />
        <p className="pricing-eyebrow">Nadi Connect</p>
        <h1>{ar ? "برنامج النوادي التجريبية" : "Programme clubs pilotes"}</h1>
        <p className="pricing-lead">
          {ar
            ? "نبحث عن 2–3 أندية للانطلاق معنا: تجربة 14 يوماً ثم اشتراك سنوي. مرافقة يدوية، بدون تعقيد."
            : "Nous recrutons 2–3 clubs pour démarrer : essai 14 jours puis abonnement annuel. Accompagnement humain, sans complexité."}
        </p>
      </header>

      <section className="pilot-steps card">
        <h2>{ar ? "كيف يعمل؟" : "Comment ça marche ?"}</h2>
        <ol>
          <li>
            {ar
              ? "عرض تجريبي 10 دقائق (مجاني) على نادي كونكت."
              : "Démo gratuite de 10 minutes sur Nadi Connect."}
          </li>
          <li>
            {ar
              ? "إنشاء ناديكم أو تجربة Discovery 14 يوماً."
              : "Création de votre club ou essai Discovery 14 jours."}
          </li>
          <li>
            {ar
              ? "تكوين سريع (دليل الاستعمال + جلسة عملية)."
              : "Formation courte (guide d’utilisation + session pratique)."}
          </li>
          <li>
            {ar
              ? "بعد 14 يوماً: باقة Club (20 000 دج/سنة) أو Academy (35 000 دج/سنة)."
              : "Après 14 jours : pack Club (20 000 DZD/an) ou Academy (35 000 DZD/an)."}
          </li>
        </ol>
      </section>

      <section className="pilot-steps card">
        <h2>{ar ? "ماذا يشمل العرض؟" : "Que comprend l’offre ?"}</h2>
        <ul>
          <li>{ar ? "تسجيلات، أولياء، جدول، مالية (دج)" : "Inscriptions, parents, agenda, finance (DZD)"}</li>
          <li>{ar ? "رياضات متعددة في نفس النادي" : "Multi-sports dans le même club"}</li>
          <li>{ar ? "موقع ويب + تطبيق أندرويد" : "Site web + application Android"}</li>
          <li>{ar ? "دعم عبر واتساب خلال التجربة" : "Support WhatsApp pendant l’essai"}</li>
        </ul>
      </section>

      <div className="landing-cta" style={{ justifyContent: "center", margin: "1.5rem 0" }}>
        <Link className="button accent" to="/onboard">
          {ar ? "ابدأ تجربة 14 يوماً" : "Démarrer l’essai 14 jours"}
        </Link>
        <Link className="button landing-cta-secondary" to="/pricing">
          {ar ? "رؤية الأسعار" : "Voir les tarifs"}
        </Link>
        <Link
          className="button landing-cta-secondary"
          to={`/login?club=${encodeURIComponent(DEMO_CLUB_SLUG)}`}
        >
          {ar ? "تجربة النادي التجريبي" : "Voir la démo live"}
        </Link>
      </div>

      <p className="muted" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 2rem" }}>
        {ar
          ? "للتواصل التجاري: راسلوا فريق نادي كونكت بعد إنشاء النادي (واتساب / بريد)."
          : "Contact commercial : après création du club, écrivez à l’équipe Nadi Connect (WhatsApp / e-mail)."}
      </p>

      <footer className="pricing-footer">
        <Link to="/">{ar ? "الرئيسية" : "Accueil"}</Link>
        <Link to="/guide">{ar ? "دليل التكوين" : "Guide"}</Link>
        <Link to="/login">{ar ? "دخول" : "Connexion"}</Link>
      </footer>
    </div>
  );
}
