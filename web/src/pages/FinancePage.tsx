import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiGetFast, loadAllSettled } from "../api/client";
import { toast } from "../components/Toast";
import { useAuth } from "../auth";

type Dash = {
  cotisations_due: number;
  cotisations_paid: number;
  ledger_expense: number;
  coach_payroll_total: number;
  monthly_subscription_dzd?: number;
  annual_insurance_dzd?: number;
  inscription_fee_dzd?: number;
};
type Ledger = {
  id: number;
  entry_type: string;
  category: string;
  label: string;
  amount: number;
  entry_date: string;
  place?: string;
};
type Payroll = { id: number; user_id: number; label: string; amount: number; pay_type: string; status: string };
type FeeSettings = {
  monthly_subscription_dzd: number;
  annual_insurance_dzd: number;
  inscription_fee_dzd: number;
};
type Category = { id: number; code: string; birth_year_min: number; birth_year_max: number };
type Athlete = { id: number; full_name: string; category_id?: number; category_code?: string };
type PaymentRow = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  amount: number;
  paid_on?: string;
  method: string;
};
type Installment = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  label: string;
  label_ar?: string;
  amount: number;
  amount_paid: number;
  status: string;
};

const MONTHS = [
  { v: 1, l: "Janvier" },
  { v: 2, l: "Février" },
  { v: 3, l: "Mars" },
  { v: 4, l: "Avril" },
  { v: 5, l: "Mai" },
  { v: 6, l: "Juin" },
  { v: 7, l: "Juillet" },
  { v: 8, l: "Août" },
  { v: 9, l: "Septembre" },
  { v: 10, l: "Octobre" },
  { v: 11, l: "Novembre" },
  { v: 12, l: "Décembre" },
];

export function FinancePage() {
  const { role } = useAuth();
  const canEditSettings = role === "admin" || role === "direction";
  const now = new Date();
  const [dash, setDash] = useState<Dash | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ monthly: "800", insurance: "1500", inscription: "4000" });
  const [cats, setCats] = useState<Category[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [recent, setRecent] = useState<PaymentRow[]>([]);
  const [unpaid, setUnpaid] = useState<Installment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPay, setSavingPay] = useState(false);
  const savingRef = useRef(false);

  const [pay, setPay] = useState({
    payment_type: "monthly",
    category_id: "",
    athlete_id: "",
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    amount: "800",
    equipment_label: "",
    paid_on: now.toISOString().slice(0, 10),
  });

  const [equip, setEquip] = useState({
    name: "",
    quantity: "1",
    unit_cost: "",
    athlete_id: "",
    category_id: "",
  });

  const [form, setForm] = useState({
    entry_type: "expense",
    category: "transport",
    label: "",
    amount: "",
    entry_date: now.toISOString().slice(0, 10),
    place: "",
    counterparty: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, errors } = await loadAllSettled<
      [Dash, Ledger[], Payroll[], FeeSettings, Category[], PaymentRow[], Installment[]]
    >([
      () => apiGetFast<Dash>("/api/v1/dashboard", { ttlMs: 20_000 }),
      () => apiGetFast<Ledger[]>("/api/v1/ledger", { ttlMs: 20_000 }),
      () => apiGetFast<Payroll[]>("/api/v1/payroll", { ttlMs: 30_000 }).catch(() => []),
      () => apiGetFast<FeeSettings>("/api/v1/finance/settings", { ttlMs: 60_000 }),
      () => apiGetFast<Category[]>("/api/v1/categories", { ttlMs: 120_000 }),
      () => api<PaymentRow[]>("/api/v1/payments/recent?limit=30").catch(() => []),
      () => api<Installment[]>("/api/v1/installments?status=due&limit=40").catch(() => []),
    ]);
    const [d, l, p, s, c, r, u] = data;
    if (d) setDash(d);
    if (l) setLedger(l);
    if (p) setPayroll(p);
    if (s) {
      setSettings(s);
      setSettingsForm({
        monthly: String(s.monthly_subscription_dzd),
        insurance: String(s.annual_insurance_dzd),
        inscription: String(s.inscription_fee_dzd),
      });
      setPay((prev) => ({
        ...prev,
        amount:
          prev.payment_type === "monthly"
            ? String(s.monthly_subscription_dzd)
            : prev.payment_type === "insurance"
              ? String(s.annual_insurance_dzd)
              : prev.payment_type === "inscription"
                ? String(s.inscription_fee_dzd)
                : prev.amount,
      }));
    }
    if (c) setCats(c);
    if (r) setRecent(r);
    if (u) setUnpaid(u);
    if (errors.length) setError(errors.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Charge les joueurs filtrés par catégorie
  useEffect(() => {
    const params = new URLSearchParams({ limit: "200", sort: "name", order: "asc" });
    if (pay.category_id) params.set("category_id", pay.category_id);
    apiGetFast<Athlete[]>(`/api/v1/athletes?${params}`, { ttlMs: 30_000 })
      .then(setAthletes)
      .catch(() => setAthletes([]));
  }, [pay.category_id]);

  const filteredAthletes = useMemo(() => athletes, [athletes]);

  function onTypeChange(type: string) {
    const amount =
      type === "monthly"
        ? settingsForm.monthly
        : type === "insurance"
          ? settingsForm.insurance
          : type === "inscription"
            ? settingsForm.inscription
            : "";
    setPay((p) => ({ ...p, payment_type: type, amount, athlete_id: p.athlete_id }));
  }

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!canEditSettings) return;
    try {
      const s = await api<FeeSettings>("/api/v1/finance/settings", {
        method: "PUT",
        body: JSON.stringify({
          monthly_subscription_dzd: Number(settingsForm.monthly),
          annual_insurance_dzd: Number(settingsForm.insurance),
          inscription_fee_dzd: Number(settingsForm.inscription),
        }),
      });
      setSettings(s);
      toast("Constantes finance enregistrées", "success");
      onTypeChange(pay.payment_type);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function onQuickPay(e: FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!pay.athlete_id) {
      toast("Sélectionnez un joueur", "error");
      return;
    }
    savingRef.current = true;
    setSavingPay(true);
    try {
      const body: Record<string, unknown> = {
        payment_type: pay.payment_type,
        athlete_id: Number(pay.athlete_id),
        category_id: pay.category_id ? Number(pay.category_id) : null,
        amount: Number(pay.amount),
        paid_on: pay.paid_on,
        method: "cash",
      };
      if (pay.payment_type === "monthly") {
        body.month = Number(pay.month);
        body.year = Number(pay.year);
      }
      if (pay.payment_type === "equipment") {
        body.equipment_label = pay.equipment_label || "équipement";
      }
      const res = await api<{ receipt_number: string; label: string; amount: number }>("/api/v1/payments/quick", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(`✓ ${res.label} — ${Number(res.amount).toLocaleString()} DZD · ${res.receipt_number}`, "success");
      setPay((p) => ({ ...p, athlete_id: "", equipment_label: "" }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      savingRef.current = false;
      setSavingPay(false);
    }
  }

  async function onEquipPurchase(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/inventory/purchase", {
        method: "POST",
        body: JSON.stringify({
          name: equip.name,
          quantity: Number(equip.quantity) || 1,
          unit_cost: Number(equip.unit_cost) || 0,
          athlete_id: equip.athlete_id ? Number(equip.athlete_id) : null,
        }),
      });
      toast("Équipement enregistré", "success");
      setEquip({ name: "", quantity: "1", unit_cost: "", athlete_id: "", category_id: equip.category_id });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/ledger", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm((f) => ({ ...f, label: "", amount: "", place: "", counterparty: "" }));
      toast("Écriture caisse enregistrée", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
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
          <div className="card stat">
            <strong>{dash.cotisations_paid.toLocaleString()} DZD</strong>
            <span>Cotisations reçues</span>
          </div>
          <div className="card stat">
            <strong>{dash.cotisations_due.toLocaleString()} DZD</strong>
            <span>Impayés</span>
          </div>
          <div className="card stat">
            <strong>{(dash.monthly_subscription_dzd ?? settings?.monthly_subscription_dzd ?? 800).toLocaleString()} DZD</strong>
            <span>Mensuel / شهري</span>
          </div>
          <div className="card stat">
            <strong>{(dash.annual_insurance_dzd ?? settings?.annual_insurance_dzd ?? 1500).toLocaleString()} DZD</strong>
            <span>Assurance / التأمين</span>
          </div>
        </div>
      )}

      {/* Constantes */}
      <form className="card" onSubmit={onSaveSettings}>
        <h3 style={{ marginTop: 0 }}>Constantes cotisations / ثوابت الاشتراك</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Paramètres du club : chaque joueur paie l’abonnement mensuel et l’assurance annuelle.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div className="field">
            <label>Abonnement mensuel (DZD)</label>
            <input
              className="ltr"
              inputMode="decimal"
              disabled={!canEditSettings}
              value={settingsForm.monthly}
              onChange={(e) => setSettingsForm({ ...settingsForm, monthly: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Assurance annuelle (DZD)</label>
            <input
              className="ltr"
              inputMode="decimal"
              disabled={!canEditSettings}
              value={settingsForm.insurance}
              onChange={(e) => setSettingsForm({ ...settingsForm, insurance: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Droits d’inscription (DZD)</label>
            <input
              className="ltr"
              inputMode="decimal"
              disabled={!canEditSettings}
              value={settingsForm.inscription}
              onChange={(e) => setSettingsForm({ ...settingsForm, inscription: e.target.value })}
            />
          </div>
        </div>
        {canEditSettings && <button type="submit">Enregistrer les constantes</button>}
      </form>

      {/* Paiement guidé */}
      <form className="card" onSubmit={onQuickPay}>
        <h3 style={{ marginTop: 0 }}>Encaisser un paiement / تسجيل دفعة</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="field">
            <label>Type de paiement</label>
            <select value={pay.payment_type} onChange={(e) => onTypeChange(e.target.value)}>
              <option value="monthly">Abonnement mensuel (800)</option>
              <option value="insurance">Assurance annuelle (1500)</option>
              <option value="inscription">Droits d’inscription</option>
              <option value="equipment">Équipement / brassards</option>
            </select>
          </div>
          <div className="field">
            <label>Catégorie joueur</label>
            <select
              value={pay.category_id}
              onChange={(e) => setPay({ ...pay, category_id: e.target.value, athlete_id: "" })}
            >
              <option value="">Toutes</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Joueur</label>
            <select
              required
              value={pay.athlete_id}
              onChange={(e) => setPay({ ...pay, athlete_id: e.target.value })}
            >
              <option value="">— Choisir —</option>
              {filteredAthletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                  {a.category_code ? ` (${a.category_code})` : ""}
                </option>
              ))}
            </select>
          </div>
          {pay.payment_type === "monthly" && (
            <>
              <div className="field">
                <label>Mois</label>
                <select value={pay.month} onChange={(e) => setPay({ ...pay, month: e.target.value })}>
                  {MONTHS.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Année</label>
                <input
                  className="ltr"
                  value={pay.year}
                  onChange={(e) => setPay({ ...pay, year: e.target.value })}
                />
              </div>
            </>
          )}
          {pay.payment_type === "equipment" && (
            <div className="field">
              <label>Article (maillot, brassards…)</label>
              <input
                required
                value={pay.equipment_label}
                onChange={(e) => setPay({ ...pay, equipment_label: e.target.value })}
                placeholder="Ex. maillot + brassards"
              />
            </div>
          )}
          <div className="field">
            <label>Montant DZD</label>
            <input
              required
              className="ltr"
              value={pay.amount}
              onChange={(e) => setPay({ ...pay, amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              className="ltr"
              value={pay.paid_on}
              onChange={(e) => setPay({ ...pay, paid_on: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" disabled={savingPay}>
          {savingPay ? "Enregistrement…" : "Enregistrer le paiement"}
        </button>
      </form>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Achat équipement stock */}
        <form className="card" onSubmit={onEquipPurchase}>
          <h3 style={{ marginTop: 0 }}>Achat équipement (stock)</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Achat club (dépense) — optionnellement attribué à un joueur.
          </p>
          <div className="field">
            <label>Article</label>
            <input
              required
              value={equip.name}
              onChange={(e) => setEquip({ ...equip, name: e.target.value })}
              placeholder="Ballons, brassards, maillots…"
            />
          </div>
          <div className="field">
            <label>Quantité</label>
            <input
              className="ltr"
              value={equip.quantity}
              onChange={(e) => setEquip({ ...equip, quantity: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Coût unitaire DZD</label>
            <input
              className="ltr"
              value={equip.unit_cost}
              onChange={(e) => setEquip({ ...equip, unit_cost: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Attribuer à (optionnel)</label>
            <select value={equip.athlete_id} onChange={(e) => setEquip({ ...equip, athlete_id: e.target.value })}>
              <option value="">— Stock club —</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Enregistrer l’achat</button>
        </form>

        <form className="card" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>Recette / Dépense libre</h3>
          <div className="field">
            <label>Type</label>
            <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
              <option value="expense">Dépense</option>
              <option value="income">Recette</option>
            </select>
          </div>
          <div className="field">
            <label>Catégorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="subscription">Abonnement</option>
              <option value="insurance">Assurance</option>
              <option value="equipment">Matériel / équipement</option>
              <option value="transport">Transport / النقل</option>
              <option value="salary">Salaire</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div className="field">
            <label>Libellé</label>
            <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="field">
            <label>Montant DZD</label>
            <input required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Lieu</label>
            <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </div>
          <div className="field">
            <label>Tiers (ex. chauffeur)</label>
            <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
          </div>
          <button type="submit">Enregistrer</button>
        </form>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Derniers paiements joueurs</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Joueur</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.paid_on || "—"}</td>
                  <td>{r.athlete_name || `#${r.athlete_id}`}</td>
                  <td>{Number(r.amount).toLocaleString()} DZD</td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    Aucun paiement
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Échéances en retard / dues</h3>
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Libellé</th>
                <th>Reste</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.slice(0, 30).map((u) => (
                <tr key={u.id}>
                  <td>{u.athlete_name || `#${u.athlete_id}`}</td>
                  <td>
                    {u.label}
                    {u.label_ar ? ` · ${u.label_ar}` : ""}
                  </td>
                  <td>{(Number(u.amount) - Number(u.amount_paid)).toLocaleString()} DZD</td>
                </tr>
              ))}
              {!unpaid.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    Aucune échéance due
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Journal de caisse</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {ledger.slice(0, 40).map((r) => (
              <tr key={r.id}>
                <td>{r.entry_date}</td>
                <td>
                  {r.label} <span className="badge">{r.category}</span>
                </td>
                <td>
                  {Number(r.amount).toLocaleString()} ({r.entry_type})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Paie coaches / حقوق المدرب</h3>
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Libellé</th>
              <th>Type</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {payroll.slice(0, 40).map((p) => (
              <tr key={p.id}>
                <td>#{p.user_id}</td>
                <td>{p.label}</td>
                <td>{p.pay_type}</td>
                <td>{Number(p.amount).toLocaleString()} DZD</td>
                <td>
                  <span className="badge">{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
