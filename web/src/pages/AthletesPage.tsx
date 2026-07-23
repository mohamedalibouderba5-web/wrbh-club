import { FormEvent, useEffect, useState } from "react";
import { api, mediaUrl } from "../api/client";
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

export function AthletesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Athlete[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
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

  async function load(search = q) {
    const data = await api<Athlete[]>(`/api/v1/athletes${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api("/api/v1/athletes", {
      method: "POST",
      body: JSON.stringify({
        full_name: form.full_name,
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        photo_path: form.photo_path || null,
        parent_phone: form.parent_phone || null,
        parent_name: form.parent_name || null,
      }),
    });
    setMsg("Joueur ajouté — حساب الولي مرتبط بالهاتف");
    setForm({ full_name: "", birth_date: "", birth_place: "", parent_phone: "", parent_name: "", photo_path: "" });
    load();
  }

  async function onStatusSave() {
    if (!editId) return;
    setMsg("");
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
      setMsg(err instanceof Error ? err.message : "Erreur");
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
              <label>Date de naissance</label>
              <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div className="field">
              <label>Lieu / مكان الميلاد</label>
              <input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
            </div>
            <div className="field">
              <label>{t("parentPhone")} *</label>
              <input
                required
                placeholder="0540…"
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
      </form>

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            placeholder="Rechercher nom…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #d7deee" }}
          />
          <button type="button" onClick={() => load()}>Filtrer</button>
        </div>
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
                    <img className="avatar" src={mediaUrl(r.photo_path)} alt="" />
                  ) : (
                    <span className="avatar placeholder">?</span>
                  )}
                </td>
                <td>{r.legacy_number ?? r.id}</td>
                <td>{r.full_name}</td>
                <td>{r.parent_phone ?? "—"}</td>
                <td>{r.birth_date ?? "—"}</td>
                <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
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
                    Statut
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="modal-backdrop">
          <div className="card modal">
            <h3>Modifier le statut / تغيير الحالة</h3>
            <div className="field">
              <label>{t("status")}</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="Active">Active / نشط</option>
                <option value="Abandonne">Abandonné / غادر</option>
                <option value="Inactif">Inactif / غير نشط</option>
              </select>
            </div>
            <div className="field">
              <label>Note / ملاحظة (obligatoire si départ)</label>
              <textarea rows={3} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onStatusSave}>Confirmer</button>
              <button type="button" className="secondary" onClick={() => setEditId(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
