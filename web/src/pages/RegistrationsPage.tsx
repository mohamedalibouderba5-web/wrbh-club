import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Season = { id: number; name: string; is_current: boolean };
type Category = { id: number; code: string; name: string; birth_year_min: number; birth_year_max: number };
type Reg = { id: number; athlete_id: number; season_id: number; status: string; source: string; registered_on?: string };

export function RegistrationsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    season_id: 0,
    category_id: 0,
    subscription_fee: "4000",
  });
  const [msg, setMsg] = useState("");

  async function refresh() {
    const [s, c, r] = await Promise.all([
      api<Season[]>("/api/v1/seasons"),
      api<Category[]>("/api/v1/categories"),
      api<Reg[]>("/api/v1/registrations"),
    ]);
    setSeasons(s);
    setCats(c);
    setRegs(r);
    const current = s.find((x) => x.is_current) || s[0];
    if (current) setForm((f) => ({ ...f, season_id: current.id }));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api("/api/v1/registrations", {
      method: "POST",
      body: JSON.stringify({
        season_id: form.season_id,
        category_id: form.category_id || null,
        subscription_fee: Number(form.subscription_fee),
        source: "web",
        athlete: {
          full_name: form.full_name,
          birth_date: form.birth_date || null,
          birth_place: form.birth_place || null,
        },
      }),
    });
    setMsg("Inscription enregistrée");
    setForm((f) => ({ ...f, full_name: "", birth_date: "", birth_place: "" }));
    refresh();
  }

  async function approve(id: number) {
    await api(`/api/v1/registrations/${id}/approve`, { method: "POST" });
    refresh();
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <form className="card" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>Nouvelle inscription</h3>
        <div className="field"><label>Nom et prénom / الاسم واللقب</label>
          <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="field"><label>Date de naissance</label>
          <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
        <div className="field"><label>Lieu de naissance / مكان الميلاد</label>
          <input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} /></div>
        <div className="field"><label>Saison</label>
          <select value={form.season_id} onChange={(e) => setForm({ ...form, season_id: Number(e.target.value) })}>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="field"><label>Catégorie / الفئة</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}>
            <option value={0}>Auto (année de naissance)</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.code} ({c.birth_year_min}-{c.birth_year_max})</option>
            ))}
          </select></div>
        <div className="field"><label>حقوق الاشتراك (DZD)</label>
          <input value={form.subscription_fee} onChange={(e) => setForm({ ...form, subscription_fee: e.target.value })} /></div>
        <button type="submit">Enregistrer</button>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
      </form>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dossiers récents</h3>
        <table>
          <thead><tr><th>ID</th><th>Athlète</th><th>Source</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {regs.slice(0, 40).map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>#{r.athlete_id}</td>
                <td>{r.source}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{r.status === "pending" && <button onClick={() => approve(r.id)}>Approuver</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
