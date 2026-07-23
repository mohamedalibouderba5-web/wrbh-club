import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useInstallPrompt } from "../pwa";

export function InstallPage() {
  const { lang, setLang } = useI18n();
  const { canInstall, installed, install } = useInstallPrompt();
  const [stepMsg, setStepMsg] = useState("");
  const ar = lang === "ar";

  async function onInstall() {
    if (canInstall) {
      const ok = await install();
      setStepMsg(ok
        ? (ar ? "تم! افتح أيقونة WRBH على الشاشة الرئيسية." : "C’est fait ! Ouvrez l’icône WRBH sur l’écran d’accueil.")
        : (ar ? "تم الإلغاء." : "Installation annulée."));
      return;
    }
    setStepMsg(ar
      ? "اضغط على ⋮ أو مشاركة ثم « إضافة إلى الشاشة الرئيسية »."
      : "Appuyez sur ⋮ (Chrome) ou Partager (iPhone) → « Ajouter à l’écran d’accueil ».");
  }

  return (
    <div className="install-page">
      <div className="install-card">
        <div className="lang-switch" style={{ justifyContent: "center" }}>
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>عربي</button>
        </div>
        <img src="/logo.png" alt="WRBH" className="install-logo" />
        <h1>{ar ? "تطبيق الوداد" : "App WRBH Club"}</h1>
        <p className="ar">الوداد الرياضي لبلدية حمادي</p>
        <p className="install-lead">
          {ar
            ? "بدون متجر، بدون إعدادات معقدة: زر واحد ويصير التطبيق على هاتفك."
            : "Sans Play Store, sans réglages compliqués : un bouton et l’app est sur votre téléphone."}
        </p>

        {installed ? (
          <div className="install-ok">
            {ar ? "✅ التطبيق مثبت. ارجع لتسجيل الدخول." : "✅ App déjà installée. Revenez pour vous connecter."}
          </div>
        ) : (
          <button type="button" className="accent install-cta" onClick={onInstall}>
            {ar ? "📲 تثبيت الآن" : "📲 Installer maintenant"}
          </button>
        )}

        {stepMsg && <p className="install-msg">{stepMsg}</p>}

        <ol className="install-steps">
          <li>{ar ? "اضغط « تثبيت الآن »" : "Appuyez sur « Installer maintenant »"}</li>
          <li>{ar ? "أكد التثبيت على هاتفك" : "Confirmez sur votre téléphone"}</li>
          <li>{ar ? "افتح أيقونة WRBH مثل أي تطبيق" : "Ouvrez l’icône WRBH comme une app normale"}</li>
          <li>{ar ? "سجّل الدخول برقم هاتف الولي" : "Connectez-vous avec le n° de téléphone du parent"}</li>
        </ol>

        <div className="install-actions">
          <Link className="btn-link" to="/login">{ar ? "دخول" : "Se connecter"}</Link>
        </div>
      </div>
    </div>
  );
}
