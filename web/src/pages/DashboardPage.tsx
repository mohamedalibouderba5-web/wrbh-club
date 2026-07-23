import { useEffect, useState } from "react";
import { api } from "../api/client";

type Dash = {
  currency: string;
  cotisations_due: number;
  cotisations_paid: number;
  ledger_income: number;
  ledger_expense: number;
  coach_payroll_total: number;
  overdue_count: number;
};

export function DashboardPage() {
  const [athletes, setAthletes] = useState(0);
  const [events, setEvents] = useState(0);
  const [finance, setFinance] = useState<Dash | null>(null);
  const [cats, setCats] = useState<{ code: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api<unknown[]>("/api/v1/athletes"),
      api<unknown[]>("/api/v1/events"),
      api<Dash>("/api/v1/dashboard").catch(() => null),
      api<{ code: string }[]>("/api/v1/categories"),
    ]).then(([a, e, f, c]) => {
      setAthletes(a.length);
      setEvents(e.length);
      setFinance(f);
      setCats(c);
    });
  }, []);

  return (
    <div className="grid" style={{ gap: "1.25rem" }}>
      <div className="grid stats">
        <div className="card stat"><strong>{athletes}</strong><span>Athlètes / اللاعبون</span></div>
        <div className="card stat"><strong>{cats.length}</strong><span>Catégories</span></div>
        <div className="card stat"><strong>{events}</strong><span>Événements agenda</span></div>
        <div className="card stat"><strong>{finance?.overdue_count ?? "—"}</strong><span>Retards cotisation</span></div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Finance (DZD)</h3>
        {finance ? (
          <div className="grid stats">
            <div className="stat"><strong>{finance.cotisations_paid.toLocaleString()}</strong><span>Cotisations encaissées</span></div>
            <div className="stat"><strong>{finance.cotisations_due.toLocaleString()}</strong><span>Reste à payer</span></div>
            <div className="stat"><strong>{finance.ledger_expense.toLocaleString()}</strong><span>Dépenses (ex. النقل)</span></div>
            <div className="stat"><strong>{finance.coach_payroll_total.toLocaleString()}</strong><span>Paie coaches</span></div>
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>Données finance réservées au staff.</p>
        )}
      </div>
    </div>
  );
}
