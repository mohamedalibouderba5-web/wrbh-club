import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = [
  "#1E3A8A",
  "#F5C518",
  "#16a34a",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#64748b",
  "#0f766e",
];

type NamedValue = { name: string; value: number };

/** Format étiquette type Excel / Power BI */
export function formatDataLabel(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return n.toLocaleString("fr-DZ");
  return String(Math.round(n * 100) / 100);
}

function ChartCard({
  title,
  subtitle,
  children,
  tall,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <div className="card chart-card">
      <div className="chart-card-head">
        <h3>{title}</h3>
        {subtitle ? <p className="muted chart-sub">{subtitle}</p> : null}
      </div>
      <div className={tall ? "chart-body chart-body-tall" : "chart-body"}>{children}</div>
    </div>
  );
}

function EmptyChart({ label = "Pas encore de données" }: { label?: string }) {
  return (
    <div className="chart-empty">
      <span className="muted">{label}</span>
    </div>
  );
}

const tipStyle = {
  background: "#0f172a",
  border: "none",
  borderRadius: 10,
  fontSize: 12,
};

const labelStyle = { fill: "#0f172a", fontSize: 11, fontWeight: 600 };

function pieLabel(props: {
  name?: string;
  value?: number;
  percent?: number;
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const { name, value, percent, cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0 } = props;
  if (!value) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const pct = percent != null ? ` ${(percent * 100).toFixed(0)}%` : "";
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {formatDataLabel(value)}
      {pct}
    </text>
  );
}

function pieOuterLabel(props: { name?: string; value?: number; percent?: number }) {
  const { name, value, percent } = props;
  if (!value) return null;
  const pct = percent != null ? ` (${(percent * 100).toFixed(0)}%)` : "";
  return `${name}: ${formatDataLabel(value)}${pct}`;
}

export function DonutChart({
  title,
  subtitle,
  data,
  innerRadius = 52,
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
  innerRadius?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!filtered.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="46%"
              innerRadius={innerRadius}
              outerRadius={84}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              label={pieLabel}
              labelLine={false}
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tipStyle}
              formatter={(v: number, n: string) => [`${formatDataLabel(v)} (${v})`, n]}
            />
            <Legend verticalAlign="bottom" height={40} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function SectorChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!filtered.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={78}
              label={pieOuterLabel}
              labelLine
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tipStyle}
              formatter={(v: number, n: string) => [`${formatDataLabel(v)}`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function VerticalBarChart({
  title,
  subtitle,
  data,
  color = CHART_COLORS[0],
  valueLabel = "Valeur",
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
  color?: string;
  valueLabel?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} tall>
      {!data.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => [formatDataLabel(v), valueLabel]} />
            <Bar dataKey="value" name={valueLabel} fill={color} radius={[6, 6, 0, 0]} maxBarSize={42}>
              <LabelList dataKey="value" position="top" style={labelStyle} formatter={formatDataLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function HistogramChart({
  title,
  subtitle,
  data,
  color = "#2563eb",
  valueLabel = "Effectif",
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
  color?: string;
  valueLabel?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} tall>
      {!data.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => [formatDataLabel(v), valueLabel]} />
            <Bar dataKey="value" name={valueLabel} fill={color} radius={[2, 2, 0, 0]} maxBarSize={28}>
              <LabelList dataKey="value" position="top" style={labelStyle} formatter={formatDataLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DualBarLineChart({
  title,
  subtitle,
  data,
  barKey,
  barLabel,
  lineKey,
  lineLabel,
  barColor = "#1E3A8A",
  lineColor = "#F5C518",
}: {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  barKey: string;
  barLabel: string;
  lineKey: string;
  lineLabel: string;
  barColor?: string;
  lineColor?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} tall>
      {!data.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatDataLabel(v)} />
            <Legend />
            <Bar yAxisId="left" dataKey={barKey} name={barLabel} fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={32}>
              <LabelList dataKey={barKey} position="top" style={labelStyle} formatter={formatDataLabel} />
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={lineKey}
              name={lineLabel}
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            >
              <LabelList dataKey={lineKey} position="top" style={{ ...labelStyle, fill: "#92400e" }} formatter={formatDataLabel} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function GroupedBarChart({
  title,
  subtitle,
  data,
  series,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} tall>
      {!data.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatDataLabel(v)} />
            <Legend />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28}>
                <LabelList dataKey={s.key} position="top" style={labelStyle} formatter={formatDataLabel} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function SoftAreaChart({
  title,
  subtitle,
  data,
  keyName,
  label,
  color = "#16a34a",
}: {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  keyName: string;
  label: string;
  color?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} tall>
      {!data.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => formatDataLabel(v)} />
            <Area type="monotone" dataKey={keyName} name={label} stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2.2} dot={{ r: 3 }}>
              <LabelList dataKey={keyName} position="top" style={labelStyle} formatter={formatDataLabel} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/** Segment Power BI — multi-sélection */
export function SlicerChipGroup({
  title,
  options,
  selected,
  onChange,
  allLabel = "Tout",
  labelOf,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  /** G0-06 : libellé FR/AR pour une clé technique (Suspended, paid…) */
  labelOf?: (key: string) => string;
}) {
  const allSelected = selected.length === 0 || selected.length === options.length;
  function toggle(opt: string) {
    if (allSelected) {
      onChange([opt]);
      return;
    }
    if (selected.includes(opt)) {
      const next = selected.filter((x) => x !== opt);
      onChange(next.length ? next : []);
    } else {
      const next = [...selected, opt];
      onChange(next.length === options.length ? [] : next);
    }
  }
  return (
    <div className="slicer-group">
      <div className="slicer-title">{title}</div>
      <div className="slicer-chips">
        <button
          type="button"
          className={`slicer-chip ${allSelected ? "active" : ""}`}
          onClick={() => onChange([])}
        >
          {allLabel}
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`slicer-chip ${!allSelected && selected.includes(opt) ? "active" : ""}`}
            onClick={() => toggle(opt)}
          >
            {labelOf ? labelOf(opt) : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SlicerPeriod({
  value,
  onChange,
  label = "Période",
}: {
  value: 3 | 6 | 12;
  onChange: (v: 3 | 6 | 12) => void;
  label?: string;
}) {
  return (
    <div className="slicer-group">
      <div className="slicer-title">{label}</div>
      <div className="slicer-chips">
        {([3, 6, 12] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`slicer-chip ${value === m ? "active" : ""}`}
            onClick={() => onChange(m)}
          >
            {m} mois
          </button>
        ))}
      </div>
    </div>
  );
}

export function SlicerSingle({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="slicer-group">
      <div className="slicer-title">{title}</div>
      <div className="slicer-chips">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`slicer-chip ${value === o.id ? "active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
