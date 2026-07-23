import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { wakeServer } from "../api/client";
import { useI18n } from "../i18n";
import { useInstallPrompt } from "../pwa";

export function LoginPage() {
  const { token, login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { canInstall, installed, install } = useInstallPrompt();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await wakeServer().catch(() => undefined);
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="lang-switch" style={{ justifyContent: "center", marginBottom: 8 }}>
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>عربي</button>
        </div>
        <img src="/logo.png" alt="WRBH" />
        <h2>WRBH Club</h2>
        <div className="ar">الوداد الرياضي لبلدية حمادي</div>
        <p className="login-hint">
          {lang === "ar"
            ? "أدخل رقم هاتف الولي ثم كلمة المرور"
            : "Entrez le téléphone du parent, puis le mot de passe"}
        </p>

        {!installed && (
          <button
            type="button"
            className="accent install-btn"
            onClick={() => (canInstall ? install() : (window.location.href = "/install"))}
          >
            {lang === "ar" ? "📲 تثبيت التطبيق على الهاتف" : "📲 Installer l'app sur mon téléphone"}
          </button>
        )}

        <div className="field">
          <label>{t("loginPhone")}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            inputMode="tel"
            placeholder="0555…"
          />
        </div>
        <div className="field">
          <label>{t("password")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <div className="error">{error}</div>}
        <button style={{ width: "100%", marginTop: 8 }} disabled={loading}>
          {loading ? "…" : t("signIn")}
        </button>
        <Link to="/install" className="login-link">
          {lang === "ar" ? "كيف أثبّت التطبيق ؟" : "Comment installer l'application ?"}
        </Link>
      </form>
    </div>
  );
}
