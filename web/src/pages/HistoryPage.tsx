import { useEffect, useState } from "react";
import { api, formatDateFr } from "../api/client";
import { useI18n } from "../i18n";

type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id?: number;
  detail?: string;
  user_id?: number;
  user_name?: string;
  created_at?: string;
};

export function HistoryPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filterEntity = entity) {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ limit: "80" });
      if (filterEntity) q.set("entity", filterEntity);
      const data = await api<AuditRow[]>(`/api/v1/audit?${q}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("history")}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Journal des opérations (inscriptions, joueurs, coachs, finance…) — utile pour récupérer ou vérifier qui a fait quoi.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={entity}
          onChange={(e) => {
            const v = e.target.value;
            setEntity(v);
            void load(v);
          }}
        >
          <option value="">Toutes les entités</option>
          <option value="athlete">Athlètes</option>
          <option value="registration">Inscriptions</option>
          <option value="user">Utilisateurs / Coachs</option>
          <option value="teams">Équipes</option>
          <option value="payment">Paiements</option>
        </select>
        <button type="button" className="secondary" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>
      {loading && <p className="muted">{t("loading")}</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !rows.length && !error && <p className="muted">{t("empty")}</p>}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Entité</th>
            <th>Qui</th>
            <th>Détail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="ltr">{r.created_at ? formatDateFr(r.created_at.slice(0, 10)) : "—"}</td>
              <td>
                <span className="badge">{r.action}</span>
              </td>
              <td>
                {r.entity}
                {r.entity_id != null ? ` #${r.entity_id}` : ""}
              </td>
              <td>{r.user_name || (r.user_id ? `#${r.user_id}` : "—")}</td>
              <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{r.detail || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
