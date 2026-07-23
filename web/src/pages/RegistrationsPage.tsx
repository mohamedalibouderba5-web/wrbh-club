import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDateFr, isDzMobile, loadAllSettled, mediaUrl } from "../api/client";
import { CallButton, PhoneCell } from "../components/CallButton";
import { PhotoCapture } from "../components/PhotoCapture";
import { useI18n } from "../i18n";

type Season = { id: number; name: string; is_current: boolean };
type Category = {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  birth_year_min: number;
  birth_year_max: number;
  season_id?: number;
};
type Reg = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  athlete_photo?: string;
  category_code?: string;
  category_id?: number;
  parent_phone?: string;
  parent_temp_password?: string;
  parent_created?: boolean;
  season_id: number;
  status: string;
  source: string;
  registered_on?: string;
};

const PAGE = 50;
const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function RegistrationsPage() {
  const { t } = useI18n();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [listCategoryId, setListCategoryId] = useState<number | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    season_id: 0,
    category_id: 0,
    subscription_fee: "4000",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
    blood_type: "",
  });

  const seasonCats = useMemo(() => {
    if (!form.season_id) return cats;
    return cats.filter((c) => !c.season_id || c.season_id === form.season_id);
  }, [cats, form.season_id]);

  const selectedCat = seasonCats.find((c) => c.id === form.category_id);

  const loadRegs = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setListLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: String(PAGE) });
        if (listCategoryId) params.set("category_id", String(listCategoryId));
        if (form.season_id) params.set("season_id", String(form.season_id));
        const r = await api<Reg[]>(`/api/v1/registrations?${params}`);
        setRegs(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
        setRegs([]);
      } finally {
        setListLoading(false);
        setLoading(false);
      }
    },
    [listCategoryId, form.season_id],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, errors } = await loadAllSettled<[Season[], Category[]]>([
        () => api<Season[]>("/api/v1/seasons"),
        () => api<Category[]>("/api/v1/categories"),
      ]);
      if (cancelled) return;
      const [s, c] = data;
      if (s) {
        setSeasons(s);
        const current = s.find((x) => x.is_current) || s[0];
        if (current) setForm((f) => ({ ...f, season_id: f.season_id || current.id }));
      }
      if (c) setCats(c);
      if (errors.length) setError(errors.join(" · "));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.season_id && !seasons.length) return;
    loadRegs();
  }, [loadRegs, form.season_id, seasons.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!form.birth_date) {
      setError("Date de naissance obligatoire");
      return;
    }
    if (!isDzMobile(form.parent_phone)) {
      setError("Téléphone DZ invalide (05/06/07 + 8 chiffres)");
      return;
    }
    if (!form.category_id) {
      setError("Choisissez une catégorie (U7 / U9 / U11 / U13)");
      return;
    }
    const year = Number(form.birth_date.slice(0, 4));
    if (selectedCat && (year < selectedCat.birth_year_min || year > selectedCat.birth_year_max)) {
      setError(
        `Année ${year} hors ${selectedCat.code} (${selectedCat.birth_year_min}–${selectedCat.birth_year_max})`,
      );
      return;
    }
    setSaving(true);
    try {
      const res = await api<Reg>("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({
          season_id: form.season_id,
          category_id: form.category_id || null,
          subscription_fee: Number(form.subscription_fee),
          source: "web",
          parent_phone: form.parent_phone,
          parent_name: form.parent_name || null,
          photo_path: form.photo_path || null,
          athlete: {
            full_name: form.full_name,
            birth_date: form.birth_date,
            birth_place: form.birth_place || null,
            photo_path: form.photo_path || null,
            blood_type: form.blood_type || null,
          },
        }),
      });
      let info = "Inscription enregistrée — التسجيل محفوظ";
      if (res.parent_created && res.parent_temp_password) {
        info += ` · Compte parent ☎ ${res.parent_phone} / mdp: ${res.parent_temp_password}`;
      } else if (res.parent_phone) {
        info += ` · Parent lié: ${res.parent_phone}`;
      }
      setMsg(info);
      setForm((f) => ({
        ...f,
        full_name: "",
        birth_date: "",
        birth_place: "",
        parent_phone: "",
        parent_name: "",
        photo_path: "",
        blood_type: "",
      }));
      // Affichage immédiat sans recharger saisons/catégories
      if (!listCategoryId || listCategoryId === res.category_id) {
        setRegs((prev) => [res, ...prev.filter((x) => x.id !== res.id)].slice(0, PAGE));
      }
      loadRegs({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: number) {
    try {
      const updated = await api<Reg>(`/api/v1/registrations/${id}/approve`, { method: "POST" });
      setRegs((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.1fr 1fr", gap: "1rem" }}>
      <form className="card" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>{t("newRegistration")}</h3>
        <div className="cat-chips">
          <strong>{t("categories2627")}</strong>
          <div className="chips">
            {seasonCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${form.category_id === c.id ? "active" : ""}`}
                onClick={() => setForm({ ...form, category_id: c.id })}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
          <img
            src="/affiche.jpg"
            alt="Affiche inscriptions 2026/2027"
            className="affiche-mini"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="form-split">
          <PhotoCapture value={form.photo_path} onUploaded={(p) => setForm({ ...form, photo_path: p })} />
          <div>
            <div className="field">
              <label>Nom et prénom / الاسم واللقب</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Date de naissance (jj/mm/aaaa)</label>
              <input
                type="date"
                required
                lang="fr-DZ"
                className="ltr"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Lieu de naissance / مكان الميلاد</label>
              <input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
            </div>
            <div className="field">
              <label>{t("bloodType")}</label>
              <select value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b || "none"} value={b}>
                    {b || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("parentPhone")} *</label>
              <div className="phone-row">
                <input
                  required
                  placeholder="05XXXXXXXX"
                  inputMode="tel"
                  className="ltr"
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                />
                <CallButton phone={form.parent_phone} />
              </div>
            </div>
            <div className="field">
              <label>Nom parent / اسم الولي</label>
              <input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="field">
          <label>Saison</label>
          <select value={form.season_id} onChange={(e) => setForm({ ...form, season_id: Number(e.target.value) })}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>حقوق الاشتراك (DZD)</label>
          <input
            className="ltr"
            inputMode="numeric"
            value={form.subscription_fee}
            onChange={(e) => setForm({ ...form, subscription_fee: e.target.value })}
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
        {error && <p style={{ color: "var(--danger, #dc2626)" }}>{error}</p>}
      </form>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ marginTop: 0 }}>{t("files")}</h3>
          <button type="button" className="secondary" onClick={() => loadRegs()}>
            {t("retry")}
          </button>
        </div>
        <div className="cat-chips">
          <strong>{t("filterCategory")}</strong>
          <div className="chips">
            <button
              type="button"
              className={`chip ${listCategoryId === null ? "active" : ""}`}
              onClick={() => setListCategoryId(null)}
            >
              {t("allCategories")}
            </button>
            {seasonCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${listCategoryId === c.id ? "active" : ""}`}
                onClick={() => setListCategoryId(c.id)}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
        </div>
        {(loading || listLoading) && <p className="muted">{t("loading")}</p>}
        {!loading && !listLoading && !regs.length && !error && <p className="muted">{t("empty")}</p>}
        {error && !regs.length && (
          <p style={{ color: "var(--danger, #dc2626)" }}>
            {error}{" "}
            <button type="button" onClick={() => loadRegs()}>
              {t("retry")}
            </button>
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Athlète</th>
              <th>Cat.</th>
              <th>Parent</th>
              <th>{t("status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.athlete_photo ? (
                    <img
                      className="avatar"
                      src={mediaUrl(r.athlete_photo)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="avatar placeholder">?</span>
                  )}
                </td>
                <td>
                  {r.athlete_name || `#${r.athlete_id}`}
                  {r.registered_on && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatDateFr(r.registered_on)}
                    </div>
                  )}
                </td>
                <td>{r.category_code || "—"}</td>
                <td>
                  <PhoneCell phone={r.parent_phone} />
                </td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>{r.status === "pending" && <button type="button" onClick={() => approve(r.id)}>OK</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
