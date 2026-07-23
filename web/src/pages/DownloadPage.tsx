import { useState } from "react";
import { useI18n } from "../i18n";
import { useInstallPrompt } from "../pwa";

const APK_URL = (import.meta.env.VITE_ANDROID_APK_URL || "").trim();
const IOS_URL = (import.meta.env.VITE_IOS_TESTFLIGHT_URL || "").trim();

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
      setMsg(
        ok
          ? ar
            ? "تم التثبيت! ابحث عن أيقونة WRBH."
            : "Installé ! Cherchez l’icône WRBH sur l’écran."
          : ar
            ? "ألغيت العملية."
            : "Installation annulée.",
      );
      return;
    }
    setMsg(
      ar
        ? "Android: قائمة ⋮ → « تثبيت التطبيق ». iPhone: مشاركة → « على الشاشة الرئيسية »."
        : "Android : menu ⋮ → « Installer l’application ». iPhone : Partager → « Sur l’écran d’accueil ».",
    );
  }

  return (
    <div className="download-page">
      <div className="card download-hero">
        <img src="/logo.png" alt="WRBH" />
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>{ar ? "ثبّت تطبيق WRBH" : "Installer l’app WRBH"}</h2>
          <div className="ar">تطبيق الوداد الرياضي لبلدية حمادي</div>
        </div>
      </div>

      <div className="card">
        <p className="download-simple">
          {ar
            ? "الطريقة الموصى بها الآن: تثبيت سريع (PWA) بدون متجر."
            : "Méthode recommandée aujourd’hui : installation rapide (PWA) sans store."}
        </p>
        <button type="button" className="accent install-cta" onClick={onInstall}>
          {installed
            ? ar
              ? "Déjà installée"
              : "Déjà installée"
            : ar
              ? "تثبيت على هاتفي (PWA)"
              : "Installer sur mon téléphone (PWA)"}
        </button>
        {msg && <p className="install-msg">{msg}</p>}

        <div className="download-who" style={{ marginTop: "1.25rem" }}>
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "تطبيقات المتاجر" : "Apps natives (stores)"}</h3>
        <p className="muted">
          {ar
            ? "APK أندرويد وTestFlight جاهزان عند توفر روابط البناء (EAS)."
            : "Liens APK Android et TestFlight iOS dès qu’un build EAS est publié."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {APK_URL ? (
            <a className="button accent" href={APK_URL} target="_blank" rel="noreferrer">
              Android APK
            </a>
          ) : (
            <button type="button" className="secondary" disabled>
              Android APK — bientôt
            </button>
          )}
          {IOS_URL ? (
            <a className="button secondary" href={IOS_URL} target="_blank" rel="noreferrer">
              iOS TestFlight
            </a>
          ) : (
            <button type="button" className="secondary" disabled>
              iOS TestFlight — bientôt
            </button>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          {ar
            ? "للمطور: عيّن VITE_ANDROID_APK_URL و VITE_IOS_TESTFLIGHT_URL ثم ابنِ بـ eas build."
            : "Dev : définir VITE_ANDROID_APK_URL / VITE_IOS_TESTFLIGHT_URL puis `eas build`."}
        </p>
      </div>

      <img
        src="/affiche.jpg"
        alt="Affiche inscriptions"
        className="download-affiche"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
