import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { toast } from "../components/Toast";
import { useI18n } from "../i18n";

type FeedbackRow = {
  id: number;
  ts?: string;
  kind: string;
  source: string;
  severity: string;
  target?: string;
  message: string;
  stack?: string;
  page_url?: string;
  user_id?: number;
  role?: string;
  meta?: Record<string, unknown>;
};

type FeedbackExport = {
  source: string;
  content: string;
  lines: number;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-DZ");
}

export function FeedbackAdminPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function load(filterKind = kind) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "500" });
      if (filterKind) query.set("kind", filterKind);
      const data = await api<FeedbackRow[]>(`/api/v1/feedback/events?${query}`);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.message, row.target, row.kind, row.severity, row.role, row.page_url]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle)),
    );
  }, [rows, search]);

  async function downloadExport() {
    setExporting(true);
    try {
      const result = await api<FeedbackExport>("/api/v1/feedback/export");
      const blob = new Blob([result.content || ""], {
        type: "application/x-ndjson;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wrbh-feedback-${new Date().toISOString().slice(0, 10)}.jsonl`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast(`${result.lines} feedback(s) exporté(s)`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export impossible", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{t("feedbackAdmin")}</h3>
          <p className="muted" style={{ margin: "0.4rem 0 0" }}>
            Réclamations, propositions et erreurs automatiques enregistrées par le système.
          </p>
        </div>
        <button
          type="button"
          className="accent"
          disabled={exporting}
          onClick={() => void downloadExport()}
        >
          {exporting ? "Export…" : "Télécharger tout (.jsonl)"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "1rem 0",
        }}
      >
        <select
          value={kind}
          onChange={(event) => {
            const value = event.target.value;
            setKind(value);
            void load(value);
          }}
        >
          <option value="">Tous les feedbacks</option>
          <option value="user_report">Retours utilisateurs</option>
          <option value="auto_error">Erreurs automatiques</option>
          <option value="api_error">Erreurs API</option>
          <option value="network">Erreurs réseau</option>
        </select>
        <input
          type="search"
          placeholder="Rechercher message, page, rôle…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button type="button" className="secondary" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>

      <p className="muted">
        {visibleRows.length} résultat(s) sur {rows.length}
      </p>
      {loading && <p className="muted">{t("loading")}</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !visibleRows.length && !error && (
        <p className="muted">{t("empty")}</p>
      )}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Niveau</th>
            <th>Page / fonction</th>
            <th>Message</th>
            <th>Utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id}>
              <td className="ltr">{formatDate(row.ts)}</td>
              <td>
                <span className="badge">
                  {row.kind === "user_report" ? "Utilisateur" : row.kind}
                </span>
              </td>
              <td>{row.severity || "—"}</td>
              <td style={{ whiteSpace: "normal", maxWidth: 220 }}>
                {row.target || row.page_url || "—"}
              </td>
              <td style={{ whiteSpace: "normal", minWidth: 240 }}>
                <strong>{row.message}</strong>
                {row.stack && (
                  <details style={{ marginTop: 6 }}>
                    <summary>Détails techniques</summary>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem" }}>
                      {row.stack}
                    </pre>
                  </details>
                )}
              </td>
              <td>
                {row.role || "—"}
                {row.user_id ? ` #${row.user_id}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
