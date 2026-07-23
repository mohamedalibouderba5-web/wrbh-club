import { useState } from "react";
import { useI18n } from "../i18n";
import { useInstallPrompt } from "../pwa";

export function DownloadPage() {
  const { lang } = useI18n();
  const { canInstall, installed, install } = useInstallPrompt();
  const [msg, setMsg] = useState("");
  const ar = lang === "ar";

  async function onInstall() {
    if (installed) {
      setMsg(ar ? "التطبيق مثبت مسبقاً على هذا الهاتف." : "L’app est déjà installée sur ce téléphone.");
      return;
    }
    if (canInstall) {
      const ok = await install();
      setMsg(ok
        ? (ar ? "تم التثبيت! ابحث عن أيقونة WRBH." : "Installé ! Cherchez l’icône WRBH sur l’écran.")
        : (ar ? "ألغيت العملية." : "Installation annulée."));
      return;
    }
    setMsg(ar
      ? "Android: قائمة ⋮ → « تثبيت التطبيق ». iPhone: مشاركة → « على الشاشة الرئيسية »."
      : "Android : menu ⋮ → « Installer l’application ». iPhone : Partager → « Sur l’écran d’accueil ».");
  }

  return (
    <div className="download-page">
      <div className="card download-hero">
        <img src="/logo.png" alt="WRBH" />
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>
            {ar ? "ثبّت تطبيق WRBH" : "Installer l’app WRBH"}
          </h2>
          <div className="ar">تطبيق الوداد الرياضي لبلدية حمادي</div>
        </div>
      </div>

      <div className="card">
        <p className="download-simple">
          {ar
            ? "لا تحتاج متجر Google ولا خبرة تقنية. اضغط الزر الأصفر، ثم أكّد — مثل أي تطبيق."
            : "Pas besoin du Play Store ni de connaissances techniques. Appuyez sur le bouton jaune, confirmez — comme une app normale."}
        </p>
        <button type="button" className="accent install-cta" onClick={onInstall}>
          {installed
            ? (ar ? "✅ مثبت" : "✅ Déjà installée")
            : (ar ? "📲 تثبيت على هاتفي" : "📲 Installer sur mon téléphone")}
        </button>
        {msg && <p className="install-msg">{msg}</p>}

        <div className="download-who">
          <div>
            <strong>{ar ? "الأولياء" : "Parents"}</strong>
            <p>{ar ? "متابعة الأبناء، الجدول، الاشتراكات" : "Suivre les enfants, planning, cotisations"}</p>
          </div>
          <div>
            <strong>{ar ? "المدربون" : "Coaches"}</strong>
            <p>{ar ? "الحضور والحصص بسهولة" : "Présences et séances en un clic"}</p>
          </div>
        </div>
      </div>

      <img src="/affiche.jpg" alt="Affiche inscriptions" className="download-affiche" />
    </div>
  );
}
