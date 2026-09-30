import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type Sport = { code: string; label: string };

export function OnboardPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const nav = useNavigate();
  const [sports, setSports] = useState<Sport[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    club_name: "",
    club_name_ar: "",
    slug: "",
    acronym: "CLUB",
    sport: "football",
    sports: [] as string[],
    admin_full_name: "",
    admin_email: "",
    admin_phone: "",
    admin_password: "",
    locale: "fr",
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/club/sports`)
      .then((r) => r.json())
      .then((d) => setSports(Array.isArray(d) ? d : []))
      .catch(() =>
        setSports([
          { code: "football", label: "Football" },
          { code: "judo", label: "Judo" },
          { code: "karate", label: "Karaté" },
        ]),
      );
  }, []);

  function onSlugFromName(name: string) {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    setForm((f) => ({ ...f, club_name: name, slug: f.slug || slug }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/club/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim().toLowerCase(),
          admin_phone: form.admin_phone.trim() || null,
          club_name_ar: form.club_name_ar.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).filter(Boolean).join(" · ")
              : data.message || `Erreur ${res.status}`;
        throw new Error(msg);
      }
      localStorage.setItem("wrbh_club_slug", data.slug);
      setOk(data.login_hint || (ar ? "تم إنشاء النادي" : "Club créé"));
      setTimeout(() => nav(`/login?club=${encodeURIComponent(data.slug)}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>{ar ? "إنشاء نادي" : "Créer un club"}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {ar
            ? "تجربة 14 يوماً — كرة القدم، جودو، كاراتيه والمزيد."
            : "Essai 14 jours — football, judo, karaté et sports populaires en Algérie."}
        </p>

        <div className="field">
          <label>{ar ? "اسم النادي" : "Nom du club"}</label>
          <input
            required
            value={form.club_name}
            onChange={(e) => onSlugFromName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{ar ? "الاسم بالعربية" : "Nom arabe"}</label>
          <input
            className="ar"
            value={form.club_name_ar}
            onChange={(e) => setForm({ ...form, club_name_ar: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{ar ? "رمز النادي (slug)" : "Code club (slug)"}</label>
          <input
            className="ltr"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            placeholder="ex: nadi-alger"
          />
        </div>
        <div className="field">
          <label>{ar ? "الرياضة الرئيسية" : "Sport principal"}</label>
          <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
            {sports.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{ar ? "رياضات إضافية (نادي متعدد الرياضات)" : "Sports additionnels (club multisport)"}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sports
              .filter((s) => s.code !== form.sport)
              .map((s) => {
                const on = form.sports.includes(s.code);
                return (
                  <label key={s.code} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          sports: on ? f.sports.filter((x) => x !== s.code) : [...f.sports, s.code],
                        }))
                      }
                    />
                    {s.label}
                  </label>
                );
              })}
          </div>
        </div>
        <div className="field">
          <label>{ar ? "اسم المدير" : "Nom de l’administrateur"}</label>
          <input
            required
            value={form.admin_full_name}
            onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Email admin</label>
          <input
            className="ltr"
            type="email"
            required
            value={form.admin_email}
            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{ar ? "هاتف (اختياري)" : "Téléphone (optionnel)"}</label>
          <input
            className="ltr"
            value={form.admin_phone}
            onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
            placeholder="0555…"
          />
        </div>
        <div className="field">
          <label>{ar ? "كلمة المرور" : "Mot de passe"}</label>
          <input
            className="ltr"
            type="password"
            required
            minLength={8}
            value={form.admin_password}
            onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
          />
        </div>

        {error && <div className="error">{error}</div>}
        {ok && <p style={{ color: "var(--ok)" }}>{ok}</p>}

        <button style={{ width: "100%", marginTop: 8 }} disabled={busy}>
          {busy ? "…" : ar ? "إنشاء وبدء التجربة" : "Créer et démarrer l’essai"}
        </button>
        <Link to="/login" className="login-link">
          {ar ? "عودة لتسجيل الدخول" : "Retour connexion"}
        </Link>
      </form>
    </div>
  );
}
