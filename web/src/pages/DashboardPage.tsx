import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGetFast, invalidateApiCache } from "../api/client";
import {
  DonutChart,
  DualBarLineChart,
  GroupedBarChart,
  HistogramChart,
  SectorChart,
  SoftAreaChart,
  SlicerChipGroup,
  SlicerPeriod,
  SlicerSingle,
  VerticalBarChart,
} from "../components/Charts";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { ParentHomePage } from "./ParentHomePage";

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

type Analytics = {
  currency: string;
  months: string[];
  registrations_by_month: number[];
  payments_by_month: number[];
  payments_cumulative: number[];
  ledger_income_by_month: number[];
  ledger_expense_by_month: number[];
  events_by_month: number[];
  events_by_type: Record<string, number>;
  athletes_by_status: Record<string, number>;
  athletes_by_category: { code: string; name: string; members: number }[];
  attendance_by_status: Record<string, number>;
  installments_by_status: Record<string, number>;
};

type Bootstrap = {
  stats: ClubStats;
  events_count: number;
  finance: Dash | null;
  analytics?: Analytics | null;
};

function dictToSeries(d: Record<string, number> | undefined, selected: string[], hideZero: boolean) {
  return Object.entries(d || {})
    .filter(([name]) => selected.length === 0 || selected.includes(name))
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((x) => !hideZero || x.value > 0);
}

function sliceTail<T>(arr: T[], n: number): T[] {
  if (!arr.length) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

function recomputeCumulative(monthly: number[]): number[] {
  let run = 0;
  return monthly.map((v) => {
    run += v;
    return Math.round(run);
  });
}

export function DashboardPage() {
  const { role } = useAuth();
  if (role === "parent") return <ParentHomePage />;
  return <StaffDashboardPage />;
}

function StaffDashboardPage() {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState<number | null>(null);
  const [finance, setFinance] = useState<Dash | null>(null);
  const [stats, setStats] = useState<ClubStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Segments type Power BI
  const [period, setPeriod] = useState<3 | 6 | 12>(12);
  const [view, setView] = useState<"all" | "sport" | "finance">("all");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [catSel, setCatSel] = useState<string[]>([]);
  const [eventTypeSel, setEventTypeSel] = useState<string[]>([]);
  const [attSel, setAttSel] = useState<string[]>([]);
  const [instSel, setInstSel] = useState<string[]>([]);
  const [hideZero, setHideZero] = useState(true);

  const apply = useCallback((b: Bootstrap) => {
    setStats(b.stats);
    setEvents(typeof b.events_count === "number" ? b.events_count : null);
    setFinance(b.finance);
    setAnalytics(b.analytics || null);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (force) {
        invalidateApiCache("/bootstrap");
        invalidateApiCache("/stats/analytics");
        setLoading(true);
      } else if (!stats) {
        setLoading(true);
      }
      setError("");
      try {
        const b = await apiGetFast<Bootstrap>("/api/v1/bootstrap", {
          ttlMs: force ? 0 : 45_000,
          onUpdate: (fresh) => {
            apply(fresh);
            setLoading(false);
          },
        });
        apply(b);
        if (!b.analytics) {
          try {
            const a = await apiGetFast<Analytics>("/api/v1/stats/analytics", { ttlMs: force ? 0 : 45_000 });
            setAnalytics(a);
          } catch {
            /* optional */
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    },
    [apply, stats],
  );

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const statusOptions = useMemo(
    () => Object.keys(analytics?.athletes_by_status || stats?.by_status || {}),
    [analytics?.athletes_by_status, stats?.by_status],
  );
  const catOptions = useMemo(() => {
    const src = analytics?.athletes_by_category?.length
      ? analytics.athletes_by_category
      : stats?.categories || [];
    return src.map((c) => c.code);
  }, [analytics?.athletes_by_category, stats?.categories]);
  const eventTypeOptions = useMemo(() => Object.keys(analytics?.events_by_type || {}), [analytics?.events_by_type]);
  const attOptions = useMemo(
    () => Object.keys(analytics?.attendance_by_status || {}),
    [analytics?.attendance_by_status],
  );
  const instOptions = useMemo(
    () => Object.keys(analytics?.installments_by_status || {}),
    [analytics?.installments_by_status],
  );

  const monthSlice = useMemo(() => {
    const months = analytics?.months || [];
    return sliceTail(months.map((_, i) => i), period);
  }, [analytics?.months, period]);

  const statusDonut = useMemo(
    () => dictToSeries(analytics?.athletes_by_status || stats?.by_status, statusSel, hideZero),
    [analytics?.athletes_by_status, stats?.by_status, statusSel, hideZero],
  );

  const categoryBars = useMemo(() => {
    const src = analytics?.athletes_by_category?.length
      ? analytics.athletes_by_category
      : stats?.categories || [];
    return src
      .filter((c) => catSel.length === 0 || catSel.includes(c.code))
      .map((c) => ({ name: c.code, value: c.members }))
      .filter((x) => !hideZero || x.value > 0);
  }, [analytics?.athletes_by_category, stats?.categories, catSel, hideZero]);

  const financeSnapshot = useMemo(() => {
    if (!finance) return [];
    const rows = [
      { name: lang === "ar" ? "محصل" : "Encaissé", value: Math.round(finance.cotisations_paid) },
      { name: lang === "ar" ? "متبقي" : "Reste", value: Math.round(finance.cotisations_due) },
      { name: lang === "ar" ? "إيرادات" : "Recettes", value: Math.round(finance.ledger_income) },
      { name: lang === "ar" ? "مصاريف" : "Dépenses", value: Math.round(finance.ledger_expense) },
      { name: lang === "ar" ? "أجور" : "Paie", value: Math.round(finance.coach_payroll_total) },
    ];
    return hideZero ? rows.filter((r) => r.value > 0) : rows;
  }, [finance, lang, hideZero]);

  const monthlyRegs = useMemo(() => {
    if (!analytics?.months?.length) return [];
    return monthSlice
      .map((i) => ({
        name: analytics.months[i],
        value: analytics.registrations_by_month[i] || 0,
      }))
      .filter((x) => !hideZero || x.value > 0);
  }, [analytics, monthSlice, hideZero]);

  const monthlyEvents = useMemo(() => {
    if (!analytics?.months?.length) return [];
    return monthSlice
      .map((i) => ({
        name: analytics.months[i],
        value: analytics.events_by_month[i] || 0,
      }))
      .filter((x) => !hideZero || x.value > 0);
  }, [analytics, monthSlice, hideZero]);

  const paymentsTrend = useMemo(() => {
    if (!analytics?.months?.length) return [];
    const mensuel = monthSlice.map((i) => Math.round(analytics.payments_by_month[i] || 0));
    const cumule = recomputeCumulative(mensuel);
    return monthSlice.map((i, j) => ({
      name: analytics.months[i],
      mensuel: mensuel[j],
      cumule: cumule[j],
    }));
  }, [analytics, monthSlice]);

  const cashflow = useMemo(() => {
    if (!analytics?.months?.length) return [];
    return monthSlice.map((i) => ({
      name: analytics.months[i],
      recettes: Math.round(analytics.ledger_income_by_month[i] || 0),
      depenses: Math.round(analytics.ledger_expense_by_month[i] || 0),
    }));
  }, [analytics, monthSlice]);

  const eventsType = useMemo(
    () => dictToSeries(analytics?.events_by_type, eventTypeSel, hideZero),
    [analytics?.events_by_type, eventTypeSel, hideZero],
  );
  const attendance = useMemo(
    () => dictToSeries(analytics?.attendance_by_status, attSel, hideZero),
    [analytics?.attendance_by_status, attSel, hideZero],
  );
  const installments = useMemo(
    () => dictToSeries(analytics?.installments_by_status, instSel, hideZero),
    [analytics?.installments_by_status, instSel, hideZero],
  );

  const filteredKpis = useMemo(() => {
    const athFromStatus = statusDonut.reduce((s, x) => s + x.value, 0);
    const active = statusDonut.find((x) => /active/i.test(x.name))?.value;
    return {
      athletes: statusSel.length ? athFromStatus : (stats?.athletes_total ?? "—"),
      active: statusSel.length ? (active ?? athFromStatus) : (stats?.athletes_active ?? "—"),
      sessions: monthlyEvents.reduce((s, x) => s + x.value, 0) || events,
    };
  }, [statusDonut, statusSel, stats, monthlyEvents, events]);

  function resetSlicers() {
    setPeriod(12);
    setView("all");
    setStatusSel([]);
    setCatSel([]);
    setEventTypeSel([]);
    setAttSel([]);
    setInstSel([]);
    setHideZero(true);
  }

  const showSport = view === "all" || view === "sport";
  const showFinance = view === "all" || view === "finance";

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <div>
          <h2 className="dashboard-title">{lang === "ar" ? "لوحة التحكم التحليلية" : "Tableaux de bord"}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {lang === "ar"
              ? "شرائح + تسميات بيانات — أسلوب Power BI"
              : "Segments + étiquettes de données — style Power BI / Excel"}
          </p>
          {loading && <span className="muted">{t("loading")}</span>}
          {error && <span style={{ color: "var(--danger, #dc2626)" }}>{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={resetSlicers}>
            {lang === "ar" ? "إعادة تعيين الشرائح" : "Réinitialiser segments"}
          </button>
          <button type="button" className="secondary" onClick={() => void refresh(true)}>
            {t("retry")}
          </button>
        </div>
      </div>

      <div className="card slicer-panel">
        <div className="slicer-panel-head">
          <strong>{lang === "ar" ? "شرائح التصفية" : "Segments (filtres)"}</strong>
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {lang === "ar" ? "نفس مبدأ Power BI" : "Même principe que Microsoft Power BI"}
          </span>
        </div>
        <div className="slicer-grid">
          <SlicerPeriod
            value={period}
            onChange={setPeriod}
            label={lang === "ar" ? "الفترة" : "Période"}
          />
          <SlicerSingle
            title={lang === "ar" ? "العرض" : "Vue"}
            value={view}
            onChange={(id) => setView(id as "all" | "sport" | "finance")}
            options={[
              { id: "all", label: lang === "ar" ? "الكل" : "Tout" },
              { id: "sport", label: lang === "ar" ? "رياضي" : "Sport" },
              { id: "finance", label: lang === "ar" ? "مالية" : "Finance" },
            ]}
          />
          {statusOptions.length > 0 && (
            <SlicerChipGroup
              title={lang === "ar" ? "حالة الرياضي" : "Statut athlète"}
              options={statusOptions}
              selected={statusSel}
              onChange={setStatusSel}
              allLabel={lang === "ar" ? "الكل" : "Tout"}
            />
          )}
          {catOptions.length > 0 && (
            <SlicerChipGroup
              title={lang === "ar" ? "الفئة" : "Catégorie"}
              options={catOptions}
              selected={catSel}
              onChange={setCatSel}
              allLabel={lang === "ar" ? "الكل" : "Tout"}
            />
          )}
          {eventTypeOptions.length > 0 && (
            <SlicerChipGroup
              title={lang === "ar" ? "نوع الحصة" : "Type de séance"}
              options={eventTypeOptions}
              selected={eventTypeSel}
              onChange={setEventTypeSel}
              allLabel={lang === "ar" ? "الكل" : "Tout"}
            />
          )}
          {attOptions.length > 0 && (
            <SlicerChipGroup
              title={lang === "ar" ? "الحضور" : "Présence"}
              options={attOptions}
              selected={attSel}
              onChange={setAttSel}
              allLabel={lang === "ar" ? "الكل" : "Tout"}
            />
          )}
          {instOptions.length > 0 && (
            <SlicerChipGroup
              title={lang === "ar" ? "أقساط" : "Échéances"}
              options={instOptions}
              selected={instSel}
              onChange={setInstSel}
              allLabel={lang === "ar" ? "الكل" : "Tout"}
            />
          )}
          <div className="slicer-group">
            <div className="slicer-title">{lang === "ar" ? "خيارات" : "Options"}</div>
            <div className="slicer-chips">
              <button
                type="button"
                className={`slicer-chip ${hideZero ? "active" : ""}`}
                onClick={() => setHideZero((v) => !v)}
              >
                {hideZero
                  ? lang === "ar"
                    ? "إخفاء الأصفار ✓"
                    : "Masquer zéros ✓"
                  : lang === "ar"
                    ? "إظهار الأصفار"
                    : "Afficher zéros"}
              </button>
              <span className="slicer-chip active soft">
                {lang === "ar" ? "تسميات البيانات ✓" : "Étiquettes de données ✓"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid stats">
        <div className="card stat">
          <strong>{filteredKpis.athletes}</strong>
          <span>{t("athletes")}</span>
        </div>
        <div className="card stat">
          <strong>{filteredKpis.active}</strong>
          <span>{t("active")}</span>
        </div>
        <div className="card stat">
          <strong>{stats?.parents_count ?? "—"}</strong>
          <span>{t("parents")}</span>
        </div>
        <div className="card stat">
          <strong>{filteredKpis.sessions ?? "—"}</strong>
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

      {stats?.unclassified_active || stats?.missing_birth_date ? (
        <div className="card" style={{ borderColor: "#F5C518" }}>
          <strong>{t("statsGap")}</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t("unclassified")}: {stats?.unclassified_active ?? 0} · {t("missingBirth")}: {stats?.missing_birth_date ?? 0}
          </p>
        </div>
      ) : null}

      {showSport && (
        <div className="charts-grid">
          <DonutChart
            title={lang === "ar" ? "توزيع الحالات (حلقة)" : "Répartition des statuts (anneau)"}
            subtitle={lang === "ar" ? "قيم + نسب" : "Valeurs + % sur le graphique"}
            data={statusDonut}
          />
          <SectorChart
            title={lang === "ar" ? "أنواع الحصص (قطاع)" : "Types de séances (secteur)"}
            subtitle={lang === "ar" ? "تسميات البيانات" : "Étiquettes nom · valeur · %"}
            data={eventsType}
          />
          <VerticalBarChart
            title={lang === "ar" ? "الفئات العمرية (أعمدة)" : "Catégories d’âge (barres)"}
            subtitle={stats?.season || t("categories2627")}
            data={categoryBars}
            valueLabel={lang === "ar" ? "أعضاء" : "Effectif"}
          />
          {showFinance && (
            <VerticalBarChart
              title={lang === "ar" ? "لمحة مالية (أعمدة)" : "Aperçu finance (barres)"}
              subtitle="DZD — étiquettes"
              data={financeSnapshot}
              color="#0f766e"
              valueLabel="DZD"
            />
          )}
        </div>
      )}

      {showSport && (
        <div className="charts-grid charts-grid-wide">
          <HistogramChart
            title={lang === "ar" ? "التسجيلات الشهرية" : "Inscriptions mensuelles (histogramme)"}
            subtitle={`${period} ${lang === "ar" ? "أشهر" : "derniers mois"}`}
            data={monthlyRegs}
            color="#1E3A8A"
            valueLabel={lang === "ar" ? "تسجيلات" : "Inscriptions"}
          />
          <HistogramChart
            title={lang === "ar" ? "الحصص الشهرية" : "Séances mensuelles (histogramme)"}
            subtitle={`${period} ${lang === "ar" ? "أشهر" : "derniers mois"}`}
            data={monthlyEvents}
            color="#7c3aed"
            valueLabel={lang === "ar" ? "حصص" : "Séances"}
          />
        </div>
      )}

      {showFinance && (
        <div className="charts-grid charts-grid-wide">
          <DualBarLineChart
            title={lang === "ar" ? "التحصيلات + المنحنى" : "Encaissements + courbe cumulative"}
            subtitle={lang === "ar" ? "أعمدة + منحنى + تسميات" : "Histogramme + courbe + étiquettes (DZD)"}
            data={paymentsTrend}
            barKey="mensuel"
            barLabel={lang === "ar" ? "شهري" : "Mensuel"}
            lineKey="cumule"
            lineLabel={lang === "ar" ? "تراكمي" : "Cumulé"}
          />
          <GroupedBarChart
            title={lang === "ar" ? "إيرادات مقابل مصاريف" : "Caisse : recettes vs dépenses"}
            subtitle={lang === "ar" ? "أعمدة مجمّعة + قيم" : "Barres groupées + valeurs (DZD)"}
            data={cashflow}
            series={[
              { key: "recettes", label: lang === "ar" ? "إيرادات" : "Recettes", color: "#16a34a" },
              { key: "depenses", label: lang === "ar" ? "مصاريف" : "Dépenses", color: "#dc2626" },
            ]}
          />
        </div>
      )}

      <div className="charts-grid">
        {showSport && (
          <DonutChart
            title={lang === "ar" ? "الحضور (حلقة)" : "Présences (anneau)"}
            subtitle={lang === "ar" ? "قيم على الحلقة" : "Valeurs sur l’anneau"}
            data={attendance}
            innerRadius={48}
          />
        )}
        {showFinance && (
          <SectorChart
            title={lang === "ar" ? "أقساط الاشتراك" : "Échéances cotisations (secteur)"}
            subtitle={lang === "ar" ? "تسميات كاملة" : "Étiquettes complètes"}
            data={installments}
          />
        )}
        {showFinance && (
          <SoftAreaChart
            title={lang === "ar" ? "منحنى التحصيل التراكمي" : "Courbe des encaissements cumulés"}
            subtitle="DZD — labels"
            data={paymentsTrend}
            keyName="cumule"
            label={lang === "ar" ? "تراكمي" : "Cumulé"}
            color="#2563eb"
          />
        )}
      </div>
    </div>
  );
}
