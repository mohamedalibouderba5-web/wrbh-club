import { useEffect, useState } from "react";
import { api, formatDateFr } from "../api/client";
import { confirmDialog } from "../components/ConfirmDialog";
import { toast } from "../components/Toast";
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

function canRestore(r: AuditRow): boolean {
  if (r.entity_id == null) return false;
  const a = (r.action || "").toLowerCase();
  const e = (r.entity || "").toLowerCase();
  if (!["delete", "archive"].includes(a)) return false;
  return ["athlete", "registration", "ledger", "user"].includes(e);
}

export function HistoryPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
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

  async function onRestore(r: AuditRow) {
    if (!canRestore(r) || r.entity_id == null) return;
    const ok = await confirmDialog({
      title: "Restaurer l'opération",
      message: `Restaurer ${r.entity} #${r.entity_id} ?\n${r.detail || ""}`,
      confirmLabel: "Restaurer",
      danger: false,
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      const e = r.entity.toLowerCase();
      if (e === "registration") {
        await api(`/api/v1/registrations/${r.entity_id}/restore`, { method: "POST" });
      } else if (e === "athlete") {
        await api(`/api/v1/athletes/${r.entity_id}/restore`, { method: "POST" });
      } else if (e === "ledger") {
        await api(`/api/v1/ledger/${r.entity_id}/restore`, { method: "POST" });
      } else if (e === "user") {
        await api(`/api/v1/auth/users/${r.entity_id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: true }),
        });
      }
      toast("Opération restaurée", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("history")}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Journal des opérations — les suppressions / archives sont récupérables via le bouton{" "}
        <strong>Restaurer</strong>.
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
          <option value="ledger">Caisse</option>
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
            <th></th>
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
              <td>
                {canRestore(r) && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === r.id}
                    onClick={() => void onRestore(r)}
                  >
                    {busyId === r.id ? "…" : "Restaurer"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
