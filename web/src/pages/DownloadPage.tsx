import { useI18n } from "../i18n";

/** APK native (GitHub Release) — surcharge possible via VITE_ANDROID_APK_URL. */
const DEFAULT_APK_URL =
  "https://github.com/mohamedalibouderba5-web/wrbh-club/releases/download/android-v1.3.0/wrbh-club-1.3.0.apk";
const APK_URL = (import.meta.env.VITE_ANDROID_APK_URL || DEFAULT_APK_URL).trim();
const APP_VERSION = "1.3.0";

export function DownloadPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="download-page">
      <div className="card download-hero">
        <img src="/logo.png" alt="WRBH" />
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>
            {ar ? "حمّل تطبيق WRBH للأندرويد" : "Télécharger l’app Android WRBH"}
          </h2>
          <div className="ar">تطبيق الوداد الرياضي لبلدية حمادي</div>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {ar ? `الإصدار ${APP_VERSION}` : `Version ${APP_VERSION}`}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="download-simple">
          {ar
            ? "تطبيق أندرويد رسمي للنادي: أولياء، مدربون وإدارة — متصل بالخادم مباشرة."
            : "Application Android officielle du club : parents, coachs et staff — connectée à l’API en ligne."}
        </p>

        <a className="button accent install-cta" href={APK_URL} download={`wrbh-club-${APP_VERSION}.apk`}>
          {ar ? "تحميل APK أندرويد" : "Télécharger l’APK Android"}
        </a>

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
        <h3 style={{ marginTop: 0 }}>{ar ? "طريقة التثبيت" : "Installation"}</h3>
        <ol className="install-steps">
          <li>
            {ar
              ? "حمّل الملف WRBH (APK) من الزر أعلاه."
              : "Téléchargez le fichier WRBH (APK) avec le bouton ci-dessus."}
          </li>
          <li>
            {ar
              ? "افتح الملف من الإشعارات أو مجلد التنزيلات."
              : "Ouvrez le fichier depuis les notifications ou le dossier Téléchargements."}
          </li>
          <li>
            {ar
              ? "إذا طلب الهاتف: اسمح بالتثبيت من « مصادر غير معروفة » / هذا المتصفح."
              : "Si Android le demande : autorisez l’installation depuis « sources inconnues » / ce navigateur."}
          </li>
          <li>
            {ar
              ? "ثبّت ثم افتح « WRBH Club » وسجّل الدخول (هاتف الولي أو بريد الطاقم)."
              : "Installez, ouvrez « WRBH Club », connectez-vous (téléphone parent ou e-mail staff)."}
          </li>
        </ol>
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.9rem" }}>
          {ar
            ? "ملاحظة: التطبيق موقّع من النادي. Google Play اختياري لاحقاً."
            : "Note : APK signée par le club. Publication Play Store optionnelle plus tard."}
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
