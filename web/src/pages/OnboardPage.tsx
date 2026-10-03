import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { MarketingShell } from "../layouts/MarketingShell";

/** Same-origin par défaut (nginx proxifie /api → API). */
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type Sport = { code: string; label: string; label_ar?: string };

const FALLBACK_SPORTS: Sport[] = [
  { code: "football", label: "Football", label_ar: "كرة القدم" },
  { code: "futsal", label: "Futsal", label_ar: "كرة الصالات" },
  { code: "handball", label: "Handball", label_ar: "كرة اليد" },
  { code: "basketball", label: "Basketball", label_ar: "كرة السلة" },
  { code: "volleyball", label: "Volleyball", label_ar: "كرة الطائرة" },
  { code: "rugby", label: "Rugby", label_ar: "الرجبي" },
  { code: "judo", label: "Judo", label_ar: "جودو" },
  { code: "karate", label: "Karaté", label_ar: "كاراتيه" },
  { code: "taekwondo", label: "Taekwondo", label_ar: "تايكواندو" },
  { code: "boxing", label: "Boxe", label_ar: "ملاكمة" },
  { code: "kickboxing", label: "Kick-boxing", label_ar: "كيك بوكسينغ" },
  { code: "wrestling", label: "Lutte", label_ar: "مصارعة" },
  { code: "athletics", label: "Athlétisme", label_ar: "ألعاب القوى" },
  { code: "swimming", label: "Natation", label_ar: "سباحة" },
  { code: "gymnastics", label: "Gymnastique", label_ar: "جمباز" },
  { code: "weightlifting", label: "Haltérophilie", label_ar: "رفع الأثقال" },
  { code: "cycling", label: "Cyclisme", label_ar: "دراجات" },
  { code: "tennis", label: "Tennis", label_ar: "تنس" },
  { code: "table_tennis", label: "Tennis de table", label_ar: "تنس الطاولة" },
  { code: "badminton", label: "Badminton", label_ar: "ريشة طائرة" },
  { code: "fencing", label: "Escrime", label_ar: "مبارزة" },
  { code: "archery", label: "Tir à l'arc", label_ar: "رماية بالقوس" },
  { code: "petanque", label: "Pétanque", label_ar: "بتنك" },
  { code: "chess", label: "Échecs", label_ar: "شطرنج" },
  { code: "water_polo", label: "Water-polo", label_ar: "كرة الماء" },
  { code: "rowing", label: "Aviron", label_ar: "تجديف" },
];

type ClubKind = "mono" | "multi";

export function OnboardPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const nav = useNavigate();
  const [sports, setSports] = useState<Sport[]>(FALLBACK_SPORTS);
  const [clubKind, setClubKind] = useState<ClubKind>("mono");
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
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (Array.isArray(d) && d.length) setSports(d);
      })
      .catch(() => setSports(FALLBACK_SPORTS));
  }, []);

  useEffect(() => {
    if (clubKind === "mono") {
      setForm((f) => ({ ...f, sports: [] }));
    }
  }, [clubKind]);

  function sportLabel(s: Sport) {
    return ar && s.label_ar ? s.label_ar : s.label;
  }

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
      if (clubKind === "multi" && form.sports.length === 0) {
        throw new Error(
          ar
            ? "اختر رياضة إضافية واحدة على الأقل للنادي متعدد الرياضات"
            : "Choisissez au moins un sport supplémentaire pour un club multisport",
        );
      }
      const res = await fetch(`${API_BASE}/api/v1/club/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim().toLowerCase(),
          sports: clubKind === "mono" ? [] : form.sports,
          admin_phone: form.admin_phone.trim() || null,
          club_name_ar: form.club_name_ar.trim() || null,
          locale: ar ? "ar" : form.locale,
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
    <MarketingShell>
      <main className="nc-marketing-page">
        <header className="nc-page-hero">
          <p className="nc-kicker">Nadi Connect</p>
          <h1>{ar ? "إنشاء نادٍ — تجربة 14 يوماً" : "Créer un club — essai 14 jours"}</h1>
          <p className="nc-lead">
            {ar
              ? "تسيير ومتابعة النوادي الرياضية — اختروا نوع النادي والرياضات، ثم أنشئوا حساب المدير."
              : "Gestion & suivi des clubs sportifs — choisissez mono ou multisport, puis créez le compte administrateur."}
          </p>
          <Link className="nc-home-link" to="/">
            ← {ar ? "العودة إلى الرئيسية" : "Retour à l’accueil"}
          </Link>
        </header>

        <form className="nc-form-panel" onSubmit={onSubmit}>
          <div className="nc-form-grid">
            <div className="field">
              <label>{ar ? "اسم النادي" : "Nom du club"}</label>
              <input required value={form.club_name} onChange={(e) => onSlugFromName(e.target.value)} />
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
          </div>

          <div className="field">
            <label>{ar ? "نوع النادي" : "Type de club"}</label>
            <div className="nc-kind-toggle">
              <button
                type="button"
                className={clubKind === "mono" ? "nc-btn nc-btn-primary" : "nc-btn nc-btn-ghost"}
                onClick={() => setClubKind("mono")}
              >
                {ar ? "رياضة واحدة" : "Monosport"}
              </button>
              <button
                type="button"
                className={clubKind === "multi" ? "nc-btn nc-btn-primary" : "nc-btn nc-btn-ghost"}
                onClick={() => setClubKind("multi")}
              >
                {ar ? "متعدد الرياضات" : "Multisport"}
              </button>
            </div>
            <p className="muted nc-hint">
              {clubKind === "mono"
                ? ar
                  ? "نادي مخصص لرياضة واحدة فقط."
                  : "Un seul sport pour tout le club."
                : ar
                  ? "رياضة رئيسية + رياضات إضافية."
                  : "Sport principal + disciplines supplémentaires."}
            </p>
          </div>

          <div className="field">
            <label>
              {clubKind === "mono"
                ? ar
                  ? "الرياضة"
                  : "Sport"
                : ar
                  ? "الرياضة الرئيسية"
                  : "Sport principal"}
            </label>
            <select
              value={form.sport}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sport: e.target.value,
                  sports: f.sports.filter((x) => x !== e.target.value),
                }))
              }
            >
              {sports.map((s) => (
                <option key={s.code} value={s.code}>
                  {sportLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {clubKind === "multi" && (
            <div className="field">
              <label>{ar ? "رياضات إضافية" : "Sports additionnels"}</label>
              <div className="nc-sport-chips">
                {sports
                  .filter((s) => s.code !== form.sport)
                  .map((s) => {
                    const on = form.sports.includes(s.code);
                    return (
                      <label key={s.code} className={on ? "nc-sport-chip on" : "nc-sport-chip"}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              sports: on
                                ? f.sports.filter((x) => x !== s.code)
                                : [...f.sports, s.code],
                            }))
                          }
                        />
                        {sportLabel(s)}
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="nc-form-grid">
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
          </div>

          {error && <div className="error">{error}</div>}
          {ok && <p className="nc-ok">{ok}</p>}

          <button className="nc-btn nc-btn-primary nc-submit" disabled={busy} type="submit">
            {busy ? "…" : ar ? "إنشاء وبدء التجربة" : "Créer et démarrer l’essai"}
          </button>
          <p className="nc-form-foot">
            <Link to="/login">{ar ? "لديكم حساب؟ تسجيل الدخول" : "Déjà un compte ? Se connecter"}</Link>
            {" · "}
            <Link to="/pricing">{ar ? "العروض" : "Voir les tarifs"}</Link>
          </p>
        </form>
      </main>
    </MarketingShell>
  );
}
