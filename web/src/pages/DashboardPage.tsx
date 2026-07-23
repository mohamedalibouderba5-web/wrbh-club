import { useCallback, useEffect, useState } from "react";
import { api, loadAllSettled } from "../api/client";
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
  unclassified_active?: number;
  missing_birth_date?: number;
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
  const [events, setEvents] = useState<number | null>(null);
  const [finance, setFinance] = useState<Dash | null>(null);
  const [stats, setStats] = useState<ClubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, errors } = await loadAllSettled<[unknown[], Dash | null, ClubStats]>([
      () => api<unknown[]>("/api/v1/events"),
      () => api<Dash>("/api/v1/dashboard").catch(() => null),
      () => api<ClubStats>("/api/v1/stats/club"),
    ]);
    const [e, f, s] = data;
    if (e) setEvents(e.length);
    if (f !== undefined) setFinance(f);
    if (s) setStats(s);
    if (errors.length) setError(errors.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          {loading && <span className="muted">{t("loading")}</span>}
          {error && <span style={{ color: "var(--danger, #dc2626)" }}>{error}</span>}
        </div>
        <button type="button" className="secondary" onClick={() => refresh()}>
          {t("retry")}
        </button>
      </div>

      <div className="grid stats">
        <div className="card stat">
          <strong>{stats?.athletes_total ?? "—"}</strong>
          <span>{t("athletes")}</span>
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
          <strong>{events ?? "—"}</strong>
          <span>{t("sessions")}</span>
        </div>
        <div className="card stat">
          <strong>{stats?.registrations_pending ?? "—"}</strong>
          <span>{t("pendingRegs")}</span>
        </div>
        <div className="card stat">
          <strong>{finance?.overdue_count ?? "—"}</strong>
          <span>{t("overdueFees")}</span>
        </div>
      </div>

      {(stats?.unclassified_active || stats?.missing_birth_date) ? (
        <div className="card" style={{ borderColor: "#F5C518" }}>
          <strong>{t("statsGap")}</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t("unclassified")}: {stats?.unclassified_active ?? 0} · {t("missingBirth")}: {stats?.missing_birth_date ?? 0}
          </p>
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {t("stats")} — {t("categories2627")}
          </h3>
          {catBars.length ? <BarChart items={catBars} /> : <p className="muted">{loading ? t("loading") : t("empty")}</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Finance (DZD)</h3>
          {financeBars.length ? (
            <BarChart items={financeBars} />
          ) : (
            <p className="muted">{t("financeStaffOnly")}</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("statusBreakdown")}</h3>
        <div className="chips">
          {Object.entries(stats?.by_status || {}).map(([k, v]) => (
            <span key={k} className={`chip status-${k}`}>
              {k}: <strong>{v}</strong>
            </span>
          ))}
          {!Object.keys(stats?.by_status || {}).length && <p className="muted">{t("empty")}</p>}
        </div>
      </div>
    </div>
  );
}
