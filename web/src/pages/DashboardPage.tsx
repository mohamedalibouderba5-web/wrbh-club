import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

type Dash = {
  currency: string;
  cotisations_due: number;
  cotisations_paid: number;
  ledger_income: number;
  ledger_expense: number;
  coach_payroll_total: number;
  overdue_count: number;
};

type ClubStats = {
  season?: string;
  athletes_total: number;
  athletes_active: number;
  athletes_left: number;
  parents_count: number;
  registrations_pending: number;
  categories: { code: string; name: string; name_ar?: string; birth_years: string; members: number }[];
  by_status: Record<string, number>;
};

function BarChart({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bar-chart">
      {items.map((i) => (
        <div key={i.label} className="bar-row">
          <span className="bar-label">{i.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(i.value / max) * 100}%`, background: i.color || "var(--blue)" }} />
          </div>
          <strong className="bar-val">{i.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState(0);
  const [finance, setFinance] = useState<Dash | null>(null);
  const [stats, setStats] = useState<ClubStats | null>(null);

  useEffect(() => {
    Promise.all([
      api<unknown[]>("/api/v1/events"),
      api<Dash>("/api/v1/dashboard").catch(() => null),
      api<ClubStats>("/api/v1/stats/club"),
    ]).then(([e, f, s]) => {
      setEvents(e.length);
      setFinance(f);
      setStats(s);
    });
  }, []);

  const catBars =
    stats?.categories.map((c) => ({
      label: lang === "ar" ? `${c.code} ${c.name_ar || ""}` : c.code,
      value: c.members,
      color: "#1E3A8A",
    })) || [];

  const financeBars = finance
    ? [
        { label: lang === "ar" ? "محصل" : "Encaissé", value: Math.round(finance.cotisations_paid), color: "#16a34a" },
        { label: lang === "ar" ? "متبقي" : "Reste", value: Math.round(finance.cotisations_due), color: "#F5C518" },
        { label: lang === "ar" ? "مصاريف" : "Dépenses", value: Math.round(finance.ledger_expense), color: "#dc2626" },
        { label: lang === "ar" ? "أجور" : "Paie", value: Math.round(finance.coach_payroll_total), color: "#2563eb" },
      ]
    : [];

  return (
    <div className="grid" style={{ gap: "1.25rem" }}>
      <div className="grid stats">
        <div className="card stat">
          <strong>{stats?.athletes_total ?? "—"}</strong>
          <span>Athlètes / اللاعبون</span>
        </div>
        <div className="card stat">
          <strong>{stats?.athletes_active ?? "—"}</strong>
          <span>{t("active")}</span>
        </div>
        <div className="card stat">
          <strong>{stats?.parents_count ?? "—"}</strong>
          <span>{t("parents")}</span>
        </div>
        <div className="card stat">
          <strong>{events}</strong>
          <span>{t("sessions")}</span>
        </div>
        <div className="card stat">
          <strong>{stats?.registrations_pending ?? "—"}</strong>
          <span>Inscriptions pending</span>
        </div>
        <div className="card stat">
          <strong>{finance?.overdue_count ?? "—"}</strong>
          <span>Retards cotisation</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("stats")} — {t("categories2627")}</h3>
          {catBars.length ? <BarChart items={catBars} /> : <p style={{ color: "var(--muted)" }}>…</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Finance (DZD)</h3>
          {financeBars.length ? (
            <BarChart items={financeBars} />
          ) : (
            <p style={{ color: "var(--muted)" }}>Données finance réservées au staff.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Répartition statuts / توزيع الحالات</h3>
        <div className="chips">
          {Object.entries(stats?.by_status || {}).map(([k, v]) => (
            <span key={k} className={`chip status-${k}`}>
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
