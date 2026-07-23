import { FormEvent, useEffect, useState } from "react";
import { api, apiGetFast, loadAllSettled } from "../api/client";

type Dash = {
  cotisations_due: number;
  cotisations_paid: number;
  ledger_expense: number;
  coach_payroll_total: number;
};
type Ledger = { id: number; entry_type: string; category: string; label: string; amount: number; entry_date: string; place?: string };
type Payroll = { id: number; user_id: number; label: string; amount: number; pay_type: string; status: string };

export function FinancePage() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    entry_type: "expense",
    category: "transport",
    label: "",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    place: "",
    counterparty: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    const { data, errors } = await loadAllSettled<[Dash, Ledger[], Payroll[]]>([
      () => apiGetFast<Dash>("/api/v1/dashboard", { ttlMs: 40_000 }),
      () => apiGetFast<Ledger[]>("/api/v1/ledger", { ttlMs: 30_000 }),
      () => apiGetFast<Payroll[]>("/api/v1/payroll", { ttlMs: 30_000 }).catch(() => []),
    ]);
    const [d, l, p] = data;
    if (d) setDash(d);
    if (l) setLedger(l);
    if (p) setPayroll(p);
    if (errors.length) setError(errors.join(" · "));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/ledger", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    setForm((f) => ({ ...f, label: "", amount: "", place: "", counterparty: "" }));
    load();
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {loading && <p className="muted">Chargement…</p>}
      {error && (
        <p style={{ color: "#dc2626" }}>
          {error}{" "}
          <button type="button" onClick={() => load()}>
            Réessayer
          </button>
        </p>
      )}
      {dash && (
        <div className="grid stats">
          <div className="card stat"><strong>{dash.cotisations_paid.toLocaleString()} DZD</strong><span>Cotisations</span></div>
          <div className="card stat"><strong>{dash.cotisations_due.toLocaleString()} DZD</strong><span>Impayés</span></div>
          <div className="card stat"><strong>{dash.ledger_expense.toLocaleString()} DZD</strong><span>Dépenses</span></div>
          <div className="card stat"><strong>{dash.coach_payroll_total.toLocaleString()} DZD</strong><span>Paie coaches</span></div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <form className="card" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>Recette / Dépense</h3>
          <div className="field"><label>Type</label>
            <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
              <option value="expense">Dépense</option>
              <option value="income">Recette</option>
            </select></div>
          <div className="field"><label>Catégorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="transport">Transport / النقل</option>
              <option value="equipment">Matériel</option>
              <option value="salary">Salaire</option>
              <option value="other">Autre</option>
            </select></div>
          <div className="field"><label>Libellé</label>
            <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div className="field"><label>Montant DZD</label>
            <input required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="field"><label>Date</label>
            <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
          <div className="field"><label>Lieu</label>
            <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></div>
          <div className="field"><label>Tiers (ex. chauffeur)</label>
            <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} /></div>
          <button type="submit">Enregistrer</button>
        </form>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Journal</h3>
          <table>
            <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr></thead>
            <tbody>
              {ledger.slice(0, 30).map((r) => (
                <tr key={r.id}>
                  <td>{r.entry_date}</td>
                  <td>{r.label} <span className="badge">{r.category}</span></td>
                  <td>{Number(r.amount).toLocaleString()} ({r.entry_type})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Paie coaches / حقوق المدرب</h3>
        <table>
          <thead><tr><th>Coach</th><th>Libellé</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead>
          <tbody>
            {payroll.slice(0, 40).map((p) => (
              <tr key={p.id}>
                <td>#{p.user_id}</td>
                <td>{p.label}</td>
                <td>{p.pay_type}</td>
                <td>{Number(p.amount).toLocaleString()} DZD</td>
                <td><span className="badge">{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
