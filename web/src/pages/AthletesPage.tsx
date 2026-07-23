import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, formatDateFr, isDzMobile, mediaUrl } from "../api/client";
import { PhotoCapture } from "../components/PhotoCapture";
import { useI18n } from "../i18n";

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
};

const PAGE = 100;

export function AthletesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Athlete[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("Active");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(
    async (search = q) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: String(PAGE) });
        if (search) params.set("q", search);
        if (statusFilter) params.set("status", statusFilter);
        const data = await api<Athlete[]>(`/api/v1/athletes?${params}`);
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [q, statusFilter],
  );

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
    try {
      await api("/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          birth_date: form.birth_date,
          birth_place: form.birth_place || null,
          photo_path: form.photo_path || null,
          parent_phone: form.parent_phone,
          parent_name: form.parent_name || null,
        }),
      });
      setMsg("Joueur ajouté — حساب الولي مرتبط بالهاتف");
      setForm({ full_name: "", birth_date: "", birth_place: "", parent_phone: "", parent_name: "", photo_path: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
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
        <div className="grid" style={{ gridTemplateColumns: "160px 1fr", gap: "1rem" }}>
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
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Lieu / مكان الميلاد</label>
              <input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
            </div>
            <div className="field">
              <label>{t("parentPhone")} *</label>
              <input
                required
                placeholder="05XXXXXXXX"
                inputMode="tel"
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Nom parent / اسم الولي</label>
              <input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
            <button type="submit">{t("save")}</button>
          </div>
        </div>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
        {error && <p style={{ color: "var(--danger, #dc2626)" }}>{error}</p>}
      </form>

      <div className="card">
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
          <button type="button" onClick={() => load()}>
            {t("filter")}
          </button>
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
                <td>{r.parent_phone || "—"}</td>
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
