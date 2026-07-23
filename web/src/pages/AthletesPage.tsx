import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, formatDateFr, isDzMobile, mediaUrl } from "../api/client";
import { CallButton, PhoneCell } from "../components/CallButton";
import { PhotoCapture } from "../components/PhotoCapture";
import { useI18n } from "../i18n";

type Category = {
  id: number;
  code: string;
  birth_year_min: number;
  birth_year_max: number;
};

type Athlete = {
  id: number;
  legacy_number?: number;
  full_name: string;
  birth_date?: string;
  birth_place?: string;
  status: string;
  notes?: string;
  photo_path?: string;
  parent_phone?: string;
  blood_type?: string;
  category_id?: number;
  category_code?: string;
};

const PAGE = 100;
const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function AthletesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Athlete[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
    blood_type: "",
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("Active");
  const [editNote, setEditNote] = useState("");
  const [editBlood, setEditBlood] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    api<Category[]>("/api/v1/categories").then(setCats).catch(() => setCats([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (qDebounced) params.set("q", qDebounced);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryId) params.set("category_id", String(categoryId));
      const data = await api<Athlete[]>(`/api/v1/athletes?${params}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qDebounced, statusFilter, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!form.birth_date) {
      setError("Date de naissance obligatoire (5–17 ans)");
      return;
    }
    if (!isDzMobile(form.parent_phone)) {
      setError("Téléphone DZ invalide (05/06/07…)");
      return;
    }
    setSaving(true);
    try {
      await api("/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          birth_date: form.birth_date,
          birth_place: form.birth_place || null,
          photo_path: form.photo_path || null,
          blood_type: form.blood_type || null,
          parent_phone: form.parent_phone,
          parent_name: form.parent_name || null,
        }),
      });
      setMsg("Joueur ajouté — حساب الولي مرتبط بالهاتف");
      setForm({
        full_name: "",
        birth_date: "",
        birth_place: "",
        parent_phone: "",
        parent_name: "",
        photo_path: "",
        blood_type: "",
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function onStatusSave() {
    if (!editId) return;
    setMsg("");
    setError("");
    try {
      await api(`/api/v1/athletes/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
          notes: editNote,
          blood_type: editBlood || null,
          confirm_status: true,
        }),
      });
      setEditId(null);
      setMsg("Statut mis à jour + notification parents");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <form className="card" onSubmit={onCreate}>
        <h3 style={{ marginTop: 0 }}>{t("addPlayer")}</h3>
        <div className="form-split">
          <PhotoCapture value={form.photo_path} onUploaded={(p) => setForm({ ...form, photo_path: p })} />
          <div>
            <div className="field">
              <label>Nom / الاسم</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Date de naissance (jj/mm/aaaa) *</label>
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
              <label>Lieu / مكان الميلاد</label>
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
            <button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
        {error && <p style={{ color: "var(--danger, #dc2626)" }}>{error}</p>}
      </form>

      <div className="card">
        <div className="cat-chips" style={{ marginBottom: 12 }}>
          <strong>{t("filterCategory")}</strong>
          <div className="chips">
            <button
              type="button"
              className={`chip ${categoryId === null ? "active" : ""}`}
              onClick={() => setCategoryId(null)}
            >
              {t("allCategories")}
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${categoryId === c.id ? "active" : ""}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            placeholder={t("searchName")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #d7deee" }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("allStatuses")}</option>
            <option value="Active">Active</option>
            <option value="Abandonne">Abandonne</option>
            <option value="Inactif">Inactif</option>
          </select>
          <button type="button" className="secondary" onClick={() => load()}>
            {t("retry")}
          </button>
        </div>
        {loading && <p className="muted">{t("loading")}</p>}
        {!loading && !rows.length && <p className="muted">{error || t("empty")}</p>}
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>#</th>
              <th>Nom / الاسم</th>
              <th>Cat.</th>
              <th>{t("bloodType")}</th>
              <th>Parent ☎</th>
              <th>Naissance</th>
              <th>{t("status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.photo_path ? (
                    <img
                      className="avatar"
                      src={mediaUrl(r.photo_path)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        const ph = document.createElement("span");
                        ph.className = "avatar placeholder";
                        ph.textContent = "?";
                        el.parentElement?.appendChild(ph);
                      }}
                    />
                  ) : (
                    <span className="avatar placeholder">?</span>
                  )}
                </td>
                <td>{r.legacy_number ?? "—"}</td>
                <td>{r.full_name}</td>
                <td>{r.category_code || "—"}</td>
                <td>{r.blood_type || "—"}</td>
                <td>
                  <PhoneCell phone={r.parent_phone} />
                </td>
                <td>{formatDateFr(r.birth_date)}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditId(r.id);
                      setEditStatus(r.status);
                      setEditNote(r.notes || "");
                      setEditBlood(r.blood_type || "");
                    }}
                  >
                    {t("status")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {t("status")} #{editId}
          </h3>
          <div className="field">
            <label>{t("status")}</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Abandonne">Abandonne</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>
          <div className="field">
            <label>{t("bloodType")}</label>
            <select value={editBlood} onChange={(e) => setEditBlood(e.target.value)}>
              {BLOOD_TYPES.map((b) => (
                <option key={b || "none"} value={b}>
                  {b || "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onStatusSave}>
              {t("save")}
            </button>
            <button type="button" className="secondary" onClick={() => setEditId(null)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
