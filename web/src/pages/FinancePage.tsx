import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiGetFast, loadAllSettled } from "../api/client";
import { confirmDialog } from "../components/ConfirmDialog";
import { SortHeader, type SortDir } from "../components/SortHeader";
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
  counterparty?: string;
  notes?: string;
  seq_no?: number;
  reference?: string;
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
  notes?: string;
  seq_no?: number;
  reference?: string;
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
  due_date?: string;
  seq_no?: number;
  reference?: string;
};

type FinanceTab = "cotisations" | "paiements" | "achats" | "caisse";

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

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

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
    coach_id: "",
  });
  const [coaches, setCoaches] = useState<{ id: number; full_name: string }[]>([]);
  const [editLedger, setEditLedger] = useState<Ledger | null>(null);
  const [editPay, setEditPay] = useState<PaymentRow | null>(null);
  const [editInst, setEditInst] = useState<Installment | null>(null);
  const [tab, setTab] = useState<FinanceTab>("cotisations");
  const [paySort, setPaySort] = useState({ key: "recent", dir: "desc" as SortDir });
  const [ledSort, setLedSort] = useState({ key: "date", dir: "desc" as SortDir });
  const [instSort, setInstSort] = useState({ key: "due", dir: "desc" as SortDir });

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
    try {
      const ch = await apiGetFast<{ id: number; full_name: string }[]>("/api/v1/coaches", { ttlMs: 120_000 });
      setCoaches(ch);
    } catch {
      setCoaches([]);
    }
    if (errors.length) setError(errors.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "200", sort: "name", order: "asc" });
    if (pay.category_id) params.set("category_id", pay.category_id);
    apiGetFast<Athlete[]>(`/api/v1/athletes?${params}`, { ttlMs: 30_000 })
      .then(setAthletes)
      .catch(() => setAthletes([]));
  }, [pay.category_id]);

  const filteredAthletes = useMemo(() => athletes, [athletes]);

  const purchases = useMemo(
    () => ledger.filter((x) => x.category === "equipment" || x.category === "achat" || /équip|equip|achat/i.test(x.label)),
    [ledger],
  );
  const caisseRows = useMemo(
    () => ledger.filter((x) => x.category !== "equipment" && x.category !== "achat"),
    [ledger],
  );

  const sortedInstallments = useMemo(() => {
    const rows = [...unpaid];
    const dir = instSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const map: Record<string, [unknown, unknown]> = {
        number: [a.seq_no ?? a.id, b.seq_no ?? b.id],
        reference: [a.reference, b.reference],
        athlete: [a.athlete_name, b.athlete_name],
        label: [a.label, b.label],
        amount: [a.amount, b.amount],
        paid: [a.amount_paid, b.amount_paid],
        due: [a.due_date, b.due_date],
        status: [a.status, b.status],
      };
      const [va, vb] = map[instSort.key] ?? [a.due_date, b.due_date];
      return cmp(va, vb) * dir;
    });
    return rows;
  }, [unpaid, instSort]);

  const sortedPayments = useMemo(() => {
    const rows = [...recent];
    const dir = paySort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const map: Record<string, [unknown, unknown]> = {
        number: [a.seq_no ?? a.id, b.seq_no ?? b.id],
        reference: [a.reference, b.reference],
        athlete: [a.athlete_name, b.athlete_name],
        amount: [a.amount, b.amount],
        recent: [a.paid_on, b.paid_on],
        method: [a.method, b.method],
      };
      const [va, vb] = map[paySort.key] ?? [a.paid_on, b.paid_on];
      return cmp(va, vb) * dir;
    });
    return rows;
  }, [recent, paySort]);

  const sortedPurchases = useMemo(() => {
    const rows = [...purchases];
    const dir = ledSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const map: Record<string, [unknown, unknown]> = {
        number: [a.seq_no ?? a.id, b.seq_no ?? b.id],
        reference: [a.reference, b.reference],
        label: [a.label, b.label],
        amount: [a.amount, b.amount],
        date: [a.entry_date, b.entry_date],
        type: [a.entry_type, b.entry_type],
      };
      const [va, vb] = map[ledSort.key] ?? [a.entry_date, b.entry_date];
      return cmp(va, vb) * dir;
    });
    return rows;
  }, [purchases, ledSort]);

  const sortedCaisse = useMemo(() => {
    const rows = [...caisseRows];
    const dir = ledSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const map: Record<string, [unknown, unknown]> = {
        number: [a.seq_no ?? a.id, b.seq_no ?? b.id],
        reference: [a.reference, b.reference],
        label: [a.label, b.label],
        amount: [a.amount, b.amount],
        date: [a.entry_date, b.entry_date],
        type: [a.entry_type, b.entry_type],
        category: [a.category, b.category],
      };
      const [va, vb] = map[ledSort.key] ?? [a.entry_date, b.entry_date];
      return cmp(va, vb) * dir;
    });
    return rows;
  }, [caisseRows, ledSort]);

  const purchaseTotal = useMemo(() => purchases.reduce((s, x) => s + Number(x.amount || 0), 0), [purchases]);
  const caisseExpense = useMemo(
    () => caisseRows.filter((x) => x.entry_type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0),
    [caisseRows],
  );
  const caisseIncome = useMemo(
    () => caisseRows.filter((x) => x.entry_type === "income").reduce((s, x) => s + Number(x.amount || 0), 0),
    [caisseRows],
  );
  const paymentsTotal = useMemo(() => recent.reduce((s, x) => s + Number(x.amount || 0), 0), [recent]);
  const unpaidRemain = useMemo(
    () => unpaid.reduce((s, x) => s + Math.max(0, Number(x.amount) - Number(x.amount_paid)), 0),
    [unpaid],
  );

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
      setSettingsForm({
        monthly: String(s.monthly_subscription_dzd),
        insurance: String(s.annual_insurance_dzd),
        inscription: String(s.inscription_fee_dzd),
      });
      toast(
        `Constantes enregistrées — assurance ${Number(s.annual_insurance_dzd).toLocaleString()} DZD (échéances ouvertes mises à jour)`,
        "success",
      );
      onTypeChange(pay.payment_type);
      // Recharge sans retomber sur un cache stale
      await load();
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
      const body = {
        entry_type: form.entry_type,
        category: form.category,
        label: form.label,
        amount: Number(form.amount),
        entry_date: form.entry_date,
        place: form.place || null,
        counterparty: form.counterparty || null,
      };
      await api("/api/v1/ledger", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setForm((f) => ({ ...f, label: "", amount: "", place: "", counterparty: "", coach_id: "" }));
      toast("Écriture caisse enregistrée", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function saveLedgerEdit() {
    if (!editLedger) return;
    try {
      await api(`/api/v1/ledger/${editLedger.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          entry_type: editLedger.entry_type,
          category: editLedger.category,
          label: editLedger.label,
          amount: Number(editLedger.amount),
          entry_date: editLedger.entry_date,
          place: editLedger.place || null,
          counterparty: editLedger.counterparty || null,
        }),
      });
      toast("Ligne caisse modifiée", "success");
      setEditLedger(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function deleteLedger(id: number) {
    if (!canEditSettings) return;
    const ok = await confirmDialog({
      title: "Supprimer la ligne de caisse",
      message:
        "Supprimer cette ligne de caisse ?\nRéversible : la ligne est archivée et reste récupérable dans Historique.",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await api(`/api/v1/ledger/${id}`, { method: "DELETE" });
      toast("Ligne supprimée (récupérable dans Historique)", "success");
      setEditLedger(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function savePaymentEdit() {
    if (!editPay) return;
    try {
      await api(`/api/v1/payments/${editPay.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: Number(editPay.amount),
          method: editPay.method,
          paid_on: editPay.paid_on,
          notes: editPay.notes || null,
        }),
      });
      toast("Paiement modifié", "success");
      setEditPay(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function saveInstallmentEdit() {
    if (!editInst) return;
    try {
      await api(`/api/v1/installments/${editInst.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: editInst.label,
          amount: Number(editInst.amount),
          amount_paid: Number(editInst.amount_paid),
          status: editInst.status,
          due_date: editInst.due_date || null,
        }),
      });
      toast("Échéance modifiée", "success");
      setEditInst(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  function onPaySort(key: string) {
    setPaySort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  }
  function onLedSort(key: string) {
    setLedSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  }
  function onInstSort(key: string) {
    setInstSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  }

  const tabs: { id: FinanceTab; label: string }[] = [
    { id: "cotisations", label: "Cotisations / Échéances" },
    { id: "paiements", label: "Paiements joueurs" },
    { id: "achats", label: "Achats" },
    { id: "caisse", label: "Recettes / Dépenses" },
  ];

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
            <strong>
              {(dash.monthly_subscription_dzd ?? settings?.monthly_subscription_dzd ?? 800).toLocaleString()} DZD
            </strong>
            <span>Cotisation mensuelle</span>
          </div>
          <div className="card stat">
            <strong>{dash.ledger_expense.toLocaleString()} DZD</strong>
            <span>Dépenses caisse</span>
          </div>
        </div>
      )}

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "primary" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cotisations" && (
        <>
          <div className="card">
            <h2>Formule — Cotisations</h2>
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Impayés restants = Σ (montant échéance − déjà payé). Constantes club ci-dessous.
            </p>
            <div className="grid stats">
              <div className="card stat">
                <strong>{unpaidRemain.toLocaleString()} DZD</strong>
                <span>Reste à encaisser (échéances)</span>
              </div>
              <div className="card stat">
                <strong>{(dash?.cotisations_paid ?? 0).toLocaleString()} DZD</strong>
                <span>Déjà encaissé</span>
              </div>
              <div className="card stat">
                <strong>{unpaid.length}</strong>
                <span>Échéances ouvertes</span>
              </div>
            </div>
            {canEditSettings && (
              <form onSubmit={onSaveSettings} className="grid" style={{ gap: "0.75rem", marginTop: "1rem" }}>
                <h3>Constantes (tarifs)</h3>
                <div className="grid two">
                  <label>
                    Mensuelle (DZD)
                    <input
                      value={settingsForm.monthly}
                      onChange={(e) => setSettingsForm((s) => ({ ...s, monthly: e.target.value }))}
                    />
                  </label>
                  <label>
                    Assurance annuelle
                    <input
                      value={settingsForm.insurance}
                      onChange={(e) => setSettingsForm((s) => ({ ...s, insurance: e.target.value }))}
                    />
                  </label>
                  <label>
                    Inscription
                    <input
                      value={settingsForm.inscription}
                      onChange={(e) => setSettingsForm((s) => ({ ...s, inscription: e.target.value }))}
                    />
                  </label>
                </div>
                <button type="submit" className="primary">
                  Enregistrer les constantes
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <h2>Tableau — Échéances</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="N°" sortKey="number" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Réf" sortKey="reference" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Joueur" sortKey="athlete" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Libellé" sortKey="label" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Montant" sortKey="amount" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Payé" sortKey="paid" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Échéance" sortKey="due" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <SortHeader label="Statut" sortKey="status" activeKey={instSort.key} dir={instSort.dir} onSort={onInstSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInstallments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.seq_no ?? "—"}</td>
                      <td>
                        <code>{row.reference || "—"}</code>
                      </td>
                      <td>{row.athlete_name || `#${row.athlete_id}`}</td>
                      <td>{row.label}</td>
                      <td>{Number(row.amount).toLocaleString()} DZD</td>
                      <td>{Number(row.amount_paid).toLocaleString()} DZD</td>
                      <td>{row.due_date || "—"}</td>
                      <td>{row.status}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setEditInst({ ...row })}>
                            Modifier
                          </button>
                          {canEditSettings && (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                void (async () => {
                                  const ok = await confirmDialog({
                                    title: "Supprimer l'échéance",
                                    message: `Supprimer l'échéance « ${row.label} » de ${row.athlete_name || row.athlete_id} ?`,
                                    confirmLabel: "Supprimer",
                                  });
                                  if (!ok) return;
                                  try {
                                    await api(`/api/v1/installments/${row.id}`, { method: "DELETE" });
                                    toast("Échéance supprimée", "success");
                                    load();
                                  } catch (err) {
                                    toast(err instanceof Error ? err.message : "Erreur", "error");
                                  }
                                })();
                              }}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedInstallments.length && (
                    <tr>
                      <td colSpan={9} className="muted">
                        Aucune échéance ouverte
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "paiements" && (
        <>
          <div className="card">
            <h2>Formule — Paiements joueurs</h2>
            <p className="muted">Total encaissements récents = Σ montants paiements listés.</p>
            <div className="grid stats">
              <div className="card stat">
                <strong>{paymentsTotal.toLocaleString()} DZD</strong>
                <span>Total paiements (liste)</span>
              </div>
              <div className="card stat">
                <strong>{recent.length}</strong>
                <span>Opérations</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Encaisser un paiement</h2>
            <form onSubmit={onQuickPay} className="grid" style={{ gap: "0.75rem" }}>
              <div className="grid two">
                <label>
                  Type
                  <select value={pay.payment_type} onChange={(e) => onTypeChange(e.target.value)}>
                    <option value="monthly">Mensuelle</option>
                    <option value="insurance">Assurance</option>
                    <option value="inscription">Inscription</option>
                    <option value="equipment">Équipement</option>
                  </select>
                </label>
                <label>
                  Catégorie
                  <select
                    value={pay.category_id}
                    onChange={(e) => setPay((p) => ({ ...p, category_id: e.target.value, athlete_id: "" }))}
                  >
                    <option value="">Toutes</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Joueur
                  <select
                    required
                    value={pay.athlete_id}
                    onChange={(e) => setPay((p) => ({ ...p, athlete_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {filteredAthletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                {pay.payment_type === "monthly" && (
                  <>
                    <label>
                      Mois
                      <select value={pay.month} onChange={(e) => setPay((p) => ({ ...p, month: e.target.value }))}>
                        {MONTHS.map((m) => (
                          <option key={m.v} value={m.v}>
                            {m.l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Année
                      <input value={pay.year} onChange={(e) => setPay((p) => ({ ...p, year: e.target.value }))} />
                    </label>
                  </>
                )}
                {pay.payment_type === "equipment" && (
                  <label>
                    Libellé équipement
                    <input
                      value={pay.equipment_label}
                      onChange={(e) => setPay((p) => ({ ...p, equipment_label: e.target.value }))}
                    />
                  </label>
                )}
                <label>
                  Montant (DZD)
                  <input value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={pay.paid_on}
                    onChange={(e) => setPay((p) => ({ ...p, paid_on: e.target.value }))}
                  />
                </label>
              </div>
              <button type="submit" className="primary" disabled={savingPay}>
                {savingPay ? "Enregistrement…" : "Enregistrer le paiement"}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Tableau — Paiements</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="N°" sortKey="number" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <SortHeader label="Réf" sortKey="reference" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <SortHeader label="Joueur" sortKey="athlete" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <SortHeader label="Montant" sortKey="amount" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <SortHeader label="Date" sortKey="recent" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <SortHeader label="Mode" sortKey="method" activeKey={paySort.key} dir={paySort.dir} onSort={onPaySort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.seq_no ?? "—"}</td>
                      <td>
                        <code>{row.reference || "—"}</code>
                      </td>
                      <td>{row.athlete_name || `#${row.athlete_id}`}</td>
                      <td>{Number(row.amount).toLocaleString()} DZD</td>
                      <td>{row.paid_on || "—"}</td>
                      <td>{row.method}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setEditPay({ ...row })}>
                            Modifier
                          </button>
                          {canEditSettings && (
                            <button
                              type="button"
                              className="danger"
                              onClick={async () => {
                                const ok = await confirmDialog({
                                  title: "Supprimer le paiement",
                                  message: `Supprimer le paiement de ${row.athlete_name || row.athlete_id} (${Number(row.amount).toLocaleString()} DZD) ?`,
                                  confirmLabel: "Supprimer",
                                });
                                if (!ok) return;
                                try {
                                  await api(`/api/v1/payments/${row.id}`, { method: "DELETE" });
                                  toast("Paiement supprimé", "success");
                                  load();
                                } catch (err) {
                                  toast(err instanceof Error ? err.message : "Erreur", "error");
                                }
                              }}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedPayments.length && (
                    <tr>
                      <td colSpan={7} className="muted">
                        Aucun paiement récent
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "achats" && (
        <>
          <div className="card">
            <h2>Formule — Achats</h2>
            <p className="muted">Total achats = Σ montants écritures achat / équipement.</p>
            <div className="grid stats">
              <div className="card stat">
                <strong>{purchaseTotal.toLocaleString()} DZD</strong>
                <span>Total achats</span>
              </div>
              <div className="card stat">
                <strong>{purchases.length}</strong>
                <span>Lignes</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Nouvel achat / équipement</h2>
            <form onSubmit={onEquipPurchase} className="grid two">
              <label>
                Désignation
                <input required value={equip.name} onChange={(e) => setEquip((x) => ({ ...x, name: e.target.value }))} />
              </label>
              <label>
                Quantité
                <input value={equip.quantity} onChange={(e) => setEquip((x) => ({ ...x, quantity: e.target.value }))} />
              </label>
              <label>
                Coût unitaire
                <input value={equip.unit_cost} onChange={(e) => setEquip((x) => ({ ...x, unit_cost: e.target.value }))} />
              </label>
              <label>
                Joueur (optionnel)
                <select value={equip.athlete_id} onChange={(e) => setEquip((x) => ({ ...x, athlete_id: e.target.value }))}>
                  <option value="">—</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary">
                Enregistrer l&apos;achat
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Tableau — Achats</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="N°" sortKey="number" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Réf" sortKey="reference" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Libellé" sortKey="label" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Montant" sortKey="amount" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Date" sortKey="date" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPurchases.map((row) => (
                    <tr key={row.id}>
                      <td>{row.seq_no ?? "—"}</td>
                      <td>
                        <code>{row.reference || "—"}</code>
                      </td>
                      <td>{row.label}</td>
                      <td>{Number(row.amount).toLocaleString()} DZD</td>
                      <td>{row.entry_date}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setEditLedger({ ...row })}>
                            Modifier
                          </button>
                          {canEditSettings && (
                            <button type="button" className="danger" onClick={() => deleteLedger(row.id)}>
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedPurchases.length && (
                    <tr>
                      <td colSpan={6} className="muted">
                        Aucun achat
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "caisse" && (
        <>
          <div className="card">
            <h2>Formule — Recettes / Dépenses</h2>
            <p className="muted">Solde = recettes − dépenses (hors achats équipement).</p>
            <div className="grid stats">
              <div className="card stat">
                <strong>{caisseIncome.toLocaleString()} DZD</strong>
                <span>Recettes</span>
              </div>
              <div className="card stat">
                <strong>{caisseExpense.toLocaleString()} DZD</strong>
                <span>Dépenses</span>
              </div>
              <div className="card stat">
                <strong>{(caisseIncome - caisseExpense).toLocaleString()} DZD</strong>
                <span>Solde</span>
              </div>
              {payroll.length > 0 && (
                <div className="card stat">
                  <strong>{payroll.reduce((s, x) => s + Number(x.amount || 0), 0).toLocaleString()} DZD</strong>
                  <span>Masse salariale coachs</span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Nouvelle écriture</h2>
            <form onSubmit={onSubmit} className="grid two">
              <label>
                Type
                <select value={form.entry_type} onChange={(e) => setForm((f) => ({ ...f, entry_type: e.target.value }))}>
                  <option value="expense">Dépense</option>
                  <option value="income">Recette</option>
                </select>
              </label>
              <label>
                Catégorie
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    setForm((f) => ({
                      ...f,
                      category,
                      coach_id: category === "salary" ? f.coach_id : "",
                      label: category === "salary" && !f.coach_id ? f.label : f.label,
                    }));
                  }}
                >
                  <option value="transport">Transport</option>
                  <option value="arbitre">Arbitrage</option>
                  <option value="location">Location</option>
                  <option value="salary">Salaire coach</option>
                  <option value="divers">Divers</option>
                  <option value="don">Don / recette</option>
                </select>
              </label>
              {form.category === "salary" && (
                <label>
                  Coach (suggestion libellé)
                  <select
                    value={form.coach_id}
                    onChange={(e) => {
                      const coach_id = e.target.value;
                      const coach = coaches.find((c) => String(c.id) === coach_id);
                      setForm((f) => ({
                        ...f,
                        coach_id,
                        label: coach ? `Salaire — ${coach.full_name}` : f.label,
                        entry_type: "expense",
                      }));
                    }}
                  >
                    <option value="">— Saisie manuelle du libellé —</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Libellé
                <input required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              </label>
              <label>
                Montant
                <input required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
                />
              </label>
              <label>
                Lieu
                <input value={form.place} onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))} />
              </label>
              <button type="submit" className="primary">
                Enregistrer
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Tableau — Caisse</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="N°" sortKey="number" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Réf" sortKey="reference" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Type" sortKey="type" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Catégorie" sortKey="category" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Libellé" sortKey="label" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Montant" sortKey="amount" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <SortHeader label="Date" sortKey="date" activeKey={ledSort.key} dir={ledSort.dir} onSort={onLedSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCaisse.map((row) => (
                    <tr key={row.id}>
                      <td>{row.seq_no ?? "—"}</td>
                      <td>
                        <code>{row.reference || "—"}</code>
                      </td>
                      <td>{row.entry_type === "income" ? "Recette" : "Dépense"}</td>
                      <td>{row.category}</td>
                      <td>{row.label}</td>
                      <td>{Number(row.amount).toLocaleString()} DZD</td>
                      <td>{row.entry_date}</td>
                      <td style={{ display: "flex", gap: "0.35rem" }}>
                        <button type="button" onClick={() => setEditLedger({ ...row })}>
                          Modifier
                        </button>
                        {canEditSettings && (
                          <button type="button" onClick={() => deleteLedger(row.id)}>
                            Suppr.
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!sortedCaisse.length && (
                    <tr>
                      <td colSpan={8} className="muted">
                        Aucune écriture
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editInst && (
        <div className="card" style={{ border: "2px solid var(--accent, #2563eb)" }}>
          <h3>Modifier l&apos;échéance #{editInst.seq_no ?? editInst.id}</h3>
          <p className="muted">
            Réf <code>{editInst.reference || "—"}</code> (immuable)
          </p>
          <div className="grid two">
            <label>
              Libellé
              <input value={editInst.label} onChange={(e) => setEditInst({ ...editInst, label: e.target.value })} />
            </label>
            <label>
              Date d&apos;échéance
              <input
                type="date"
                value={editInst.due_date || ""}
                onChange={(e) => setEditInst({ ...editInst, due_date: e.target.value })}
              />
            </label>
            <label>
              Montant
              <input
                value={String(editInst.amount)}
                onChange={(e) => setEditInst({ ...editInst, amount: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Déjà payé
              <input
                value={String(editInst.amount_paid)}
                onChange={(e) => setEditInst({ ...editInst, amount_paid: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Statut
              <select value={editInst.status} onChange={(e) => setEditInst({ ...editInst, status: e.target.value })}>
                <option value="due">due</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
                <option value="overdue">overdue</option>
                <option value="waived">waived</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="button" className="primary" onClick={saveInstallmentEdit}>
              Enregistrer
            </button>
            <button type="button" onClick={() => setEditInst(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {editPay && (
        <div className="card" style={{ border: "2px solid var(--accent, #2563eb)" }}>
          <h3>Modifier le paiement #{editPay.seq_no ?? editPay.id}</h3>
          <p className="muted">
            Réf <code>{editPay.reference || "—"}</code> (immuable)
          </p>
          <div className="grid two">
            <label>
              Montant
              <input
                value={String(editPay.amount)}
                onChange={(e) => setEditPay({ ...editPay, amount: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Mode
              <input value={editPay.method} onChange={(e) => setEditPay({ ...editPay, method: e.target.value })} />
            </label>
            <label>
              Date
              <input
                type="date"
                value={editPay.paid_on || ""}
                onChange={(e) => setEditPay({ ...editPay, paid_on: e.target.value })}
              />
            </label>
            <label>
              Notes
              <input
                value={editPay.notes || ""}
                onChange={(e) => setEditPay({ ...editPay, notes: e.target.value })}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="button" className="primary" onClick={savePaymentEdit}>
              Enregistrer
            </button>
            <button type="button" onClick={() => setEditPay(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {editLedger && (
        <div className="card" style={{ border: "2px solid var(--accent, #2563eb)" }}>
          <h3>Modifier l&apos;écriture #{editLedger.seq_no ?? editLedger.id}</h3>
          <p className="muted">
            Réf <code>{editLedger.reference || "—"}</code> (immuable)
          </p>
          <div className="grid two">
            <label>
              Type
              <select
                value={editLedger.entry_type}
                onChange={(e) => setEditLedger({ ...editLedger, entry_type: e.target.value })}
              >
                <option value="expense">Dépense</option>
                <option value="income">Recette</option>
              </select>
            </label>
            <label>
              Catégorie
              <input
                value={editLedger.category}
                onChange={(e) => setEditLedger({ ...editLedger, category: e.target.value })}
              />
            </label>
            <label>
              Libellé
              <input value={editLedger.label} onChange={(e) => setEditLedger({ ...editLedger, label: e.target.value })} />
            </label>
            <label>
              Montant
              <input
                value={String(editLedger.amount)}
                onChange={(e) => setEditLedger({ ...editLedger, amount: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={editLedger.entry_date}
                onChange={(e) => setEditLedger({ ...editLedger, entry_date: e.target.value })}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="button" className="primary" onClick={saveLedgerEdit}>
              Enregistrer
            </button>
            <button type="button" onClick={() => setEditLedger(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
