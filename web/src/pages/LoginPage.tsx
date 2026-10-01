import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { wakeServer } from "../api/client";
import { useI18n } from "../i18n";
import { useInstallPrompt } from "../pwa";

type ClubPublic = {
  slug: string;
  name: string;
  name_ar?: string | null;
  acronym: string;
  sport: string;
  primary_color: string;
  accent_color: string;
  logo_path?: string | null;
  app_name?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function LoginPage() {
  const { token, login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { canInstall, installed, install } = useInstallPrompt();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState<ClubPublic[]>([]);
  const [clubSlug, setClubSlug] = useState(() => {
    const fromUrl = params.get("club") || "";
    return fromUrl || localStorage.getItem("wrbh_club_slug") || "";
  });
  const [brand, setBrand] = useState<ClubPublic | null>(null);

  const sessionHint = useMemo(() => {
    if (params.get("session") === "1" || params.get("expired") === "1") {
      return lang === "ar"
        ? "انتهت صلاحية الجلسة — يرجى تسجيل الدخول من جديد"
        : "Session expirée — reconnectez-vous pour continuer";
    }
    return "";
  }, [params, lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/club/list`);
        if (!res.ok) return;
        const data = (await res.json()) as ClubPublic[];
        if (cancelled) return;
        setClubs(data);
        // B4 : plus d'auto-sélection wrbh (portefeuille non exposé). Slug saisi à la main.
        if (!clubSlug && data.length === 1) setClubSlug(data[0].slug);
      } catch {
        /* mono-club fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clubSlug) {
      setBrand(null);
      return;
    }
    const local = clubs.find((c) => c.slug === clubSlug);
    if (local) setBrand(local);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/club/branding?slug=${encodeURIComponent(clubSlug)}`);
        if (!res.ok || cancelled) return;
        const b = await res.json();
        if (cancelled) return;
        setBrand({
          slug: b.slug || clubSlug,
          name: b.name,
          name_ar: b.name_ar,
          acronym: b.acronym || "CLUB",
          sport: b.sport || "football",
          primary_color: b.primary_color || "#1E3A8A",
          accent_color: b.accent_color || "#F5C518",
          logo_path: b.logo_path,
          app_name: b.app_name,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubSlug, clubs]);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (clubSlug) localStorage.setItem("wrbh_club_slug", clubSlug);
      await wakeServer().catch(() => undefined);
      await login(username, password, clubSlug || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const productName = lang === "ar" ? "نادي كونكت" : "Nadi Connect";
  const clubTitle = brand?.name || "";
  const subtitle = brand?.name_ar || (lang === "ar" ? "النادي المتصل" : "Le club connecté");

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="lang-switch" style={{ justifyContent: "center", marginBottom: 8 }}>
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
            FR
          </button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
            عربي
          </button>
        </div>
        <img src="/logo.png" alt={productName} />
        <h2>{productName}</h2>
        <div className="ar">{subtitle}</div>
        {clubTitle && (
          <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
            {clubTitle}
            {brand?.acronym ? ` · ${brand.acronym}` : ""}
            {brand?.sport ? ` · ${brand.sport}` : ""}
          </p>
        )}
        <p className="login-hint">
          {lang === "ar"
            ? "أدخل رمز النادي (اختياري للمنصة) ثم الهاتف أو البريد وكلمة المرور"
            : "Code club (optionnel plateforme), puis téléphone/email et mot de passe"}
        </p>
        {sessionHint && (
          <div className="error" style={{ marginBottom: 8 }}>
            {sessionHint}
          </div>
        )}

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
          <label>{lang === "ar" ? "النادي (رمز)" : "Club (code)"}</label>
          {clubs.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setClubSlug(e.target.value);
              }}
              style={{ marginBottom: 8 }}
            >
              <option value="">
                {lang === "ar" ? "— أندية العرض (اختياري) —" : "— Clubs vitrine (optionnel) —"}
              </option>
              {clubs.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.slug}) · {c.sport}
                </option>
              ))}
            </select>
          )}
          <input
            className="ltr"
            value={clubSlug}
            onChange={(e) => setClubSlug(e.target.value.trim().toLowerCase())}
            placeholder="code-club"
            autoComplete="organization"
            required
          />
        </div>

        <div className="field">
          <label>{t("loginPhone")}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            inputMode="tel"
            placeholder="0555… / email"
          />
        </div>
        <div className="field">
          <label>{t("password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button style={{ width: "100%", marginTop: 8 }} disabled={loading}>
          {loading ? "…" : t("signIn")}
        </button>
        <Link to="/onboard" className="login-link">
          {lang === "ar" ? "إنشاء نادي جديد (تجربة 14 يوماً)" : "Créer un club (essai 14 jours)"}
        </Link>
        <Link to="/pricing" className="login-link">
          {lang === "ar" ? "العروض والأسعار" : "Offres & tarifs"}
        </Link>
        <Link to="/install" className="login-link">
          {lang === "ar" ? "كيف أثبّت التطبيق ؟" : "Comment installer l'application ?"}
        </Link>
        <Link to="/download" className="login-link">
          {lang === "ar" ? "تحميل تطبيق أندرويد (APK)" : "Télécharger l’app Android (APK)"}
        </Link>
      </form>
    </div>
  );
}
