import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function LandingPage() {
  const { lang, setLang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="landing" dir={ar ? "rtl" : "ltr"}>
      <header className="landing-top">
        <div className="lang-switch">
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
            FR
          </button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
            عربي
          </button>
        </div>
        <Link className="landing-login" to="/login">
          {ar ? "دخول" : "Connexion"}
        </Link>
      </header>

      <section className="landing-hero">
        <img src="/logo.png" alt="Nadi Connect" className="landing-logo" />
        <h1 className="landing-brand">Nadi Connect</h1>
        <p className="landing-tag">{ar ? "النادي المتصل" : "Le club connecté"}</p>
        <p className="landing-one">
          {ar
            ? "تسيير النادي الرياضي — أولياء، مدربون وإدارة في نظام واحد."
            : "Gestion du club sportif — parents, coachs et direction sur une seule plateforme."}
        </p>
        <div className="landing-cta">
          <Link className="button accent" to="/onboard">
            {ar ? "تجربة 14 يوماً" : "Essai 14 jours"}
          </Link>
          <Link className="button landing-cta-secondary" to="/pricing">
            {ar ? "العروض" : "Voir les offres"}
          </Link>
          <Link className="button landing-cta-secondary" to="/pilote">
            {ar ? "نادٍ تجريبي" : "Devenir pilote"}
          </Link>
        </div>
      </section>

      <section className="landing-block">
        <h2>{ar ? "لماذا نادي كونكت؟" : "Pourquoi Nadi Connect ?"}</h2>
        <p>
          {ar
            ? "نادي تعني «نادي» بالعربية. كونكت = النادي مربوط بنظام تسيير كامل (تسجيلات، جدول، مالية، تطبيق أولياء)."
            : "« Nadi » signifie club en arabe. Connect = le club relié à un système de gestion complet (inscriptions, agenda, finance, app parents)."}
        </p>
      </section>

      <section className="landing-block">
        <h2>{ar ? "لمن؟" : "Pour qui ?"}</h2>
        <ul className="landing-list">
          <li>{ar ? "أندية كرة القدم والشباب" : "Clubs de football et jeunes"}</li>
          <li>{ar ? "جودو، كاراتيه، سباحة ورياضات أخرى" : "Judo, karaté, natation et autres sports"}</li>
          <li>{ar ? "نوادي متعددة الرياضات في الجزائر" : "Clubs multi-sports en Algérie"}</li>
        </ul>
      </section>

      <section className="landing-block landing-block--cta">
        <h2>{ar ? "ابدأ الآن" : "Commencer"}</h2>
        <p>
          {ar
            ? "أنشئ ناديك في دقائق — أو سجّل الدخول إذا كان لديك حساب."
            : "Créez votre club en quelques minutes — ou connectez-vous si vous avez déjà un compte."}
        </p>
        <div className="landing-cta">
          <Link className="button accent" to="/onboard">
            {ar ? "إنشاء نادي" : "Créer un club"}
          </Link>
          <Link className="button landing-cta-secondary" to="/login">
            {ar ? "تسجيل الدخول" : "Se connecter"}
          </Link>
          <Link className="button landing-cta-secondary" to="/pilote">
            {ar ? "برنامج التجريبيين" : "Programme pilotes"}
          </Link>
        </div>
      </section>

      <footer className="landing-foot">
        <Link to="/pricing">{ar ? "الأسعار" : "Tarifs"}</Link>
        <Link to="/pilote">{ar ? "نوادي تجريبية" : "Pilotes"}</Link>
        <Link to="/install">{ar ? "تثبيت التطبيق" : "Installer l’app"}</Link>
        <span>Nadi Connect · DZD · FR / AR</span>
      </footer>
    </div>
  );
}
