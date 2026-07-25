import { useEffect, useMemo, useState } from "react";
import { api, loadAllSettled } from "../api/client";
import { toast } from "../components/Toast";
import { useAuth } from "../auth";

type Coach = { id: number; full_name: string; phone?: string; email?: string };
type TeamCoach = {
  id: number;
  team_id: number;
  user_id: number;
  role_label: string;
  coach_name?: string;
};
type TeamRow = {
  id: number;
  category_id: number;
  name: string;
  name_ar?: string;
  category_code?: string;
  coaches: TeamCoach[];
};

export function TeamsPage() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "direction" || role === "staff";
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ user_id: number; role_label: string }[]>([]);
  const [addCoachId, setAddCoachId] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data, errors } = await loadAllSettled<[TeamRow[], Coach[]]>([
        () => api<TeamRow[]>("/api/v1/teams/coaches"),
        () => api<Coach[]>("/api/v1/coaches"),
      ]);
      if (data[0]) {
        setTeams(data[0]);
        if (!selectedId && data[0][0]) selectTeam(data[0][0]);
        else if (selectedId) {
          const t = data[0].find((x) => x.id === selectedId);
          if (t) selectTeam(t);
        }
      }
      if (data[1]) setCoaches(data[1]);
      if (errors.length) setMsg(errors.join(" · "));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur chargement");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTeam(t: TeamRow) {
    setSelectedId(t.id);
    setDraft(
      t.coaches.map((c) => ({
        user_id: c.user_id,
        role_label: c.role_label === "primary" ? "primary" : c.role_label || "coach",
      })),
    );
    setAddCoachId("");
  }

  const selected = useMemo(() => teams.find((t) => t.id === selectedId) || null, [teams, selectedId]);

  const available = useMemo(
    () => coaches.filter((c) => !draft.some((d) => d.user_id === c.id)),
    [coaches, draft],
  );

  function addCoach() {
    if (!addCoachId) return;
    const uid = Number(addCoachId);
    const isFirst = draft.length === 0;
    setDraft((d) => [...d, { user_id: uid, role_label: isFirst ? "primary" : "coach" }]);
    setAddCoachId("");
  }

  function removeCoach(userId: number) {
    setDraft((d) => {
      const next = d.filter((x) => x.user_id !== userId);
      if (next.length && !next.some((x) => x.role_label === "primary")) {
        next[0] = { ...next[0], role_label: "primary" };
      }
      return next;
    });
  }

  function setPrimary(userId: number) {
    setDraft((d) =>
      d.map((x) => ({
        ...x,
        role_label: x.user_id === userId ? "primary" : x.role_label === "primary" ? "coach" : x.role_label,
      })),
    );
  }

  async function save() {
    if (!selected || !canEdit) return;
    setSaving(true);
    try {
      await api(`/api/v1/teams/${selected.id}/coaches`, {
        method: "PUT",
        body: JSON.stringify({
          coaches: draft.map((d) => ({
            user_id: d.user_id,
            role_label: d.role_label,
            is_primary: d.role_label === "primary",
          })),
        }),
      });
      toast("Coachs de l'équipe enregistrés", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  function coachName(id: number) {
    return coaches.find((c) => c.id === id)?.full_name || `#${id}`;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "280px 1fr", gap: "1rem" }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Équipes / الفرق</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
          Chaque catégorie a son coach. Un coach peut entraîner plusieurs équipes (ex. U11 + U14).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {teams.map((t) => {
            const primary = t.coaches.find((c) => c.role_label === "primary") || t.coaches[0];
            return (
              <button
                key={t.id}
                type="button"
                className={selectedId === t.id ? "accent" : ""}
                style={{ textAlign: "start" }}
                onClick={() => selectTeam(t)}
              >
                <strong>
                  {t.category_code ? `${t.category_code} · ` : ""}
                  {t.name}
                </strong>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {primary?.coach_name || "Sans coach"}
                  {t.coaches.length > 1 ? ` (+${t.coaches.length - 1})` : ""}
                </div>
              </button>
            );
          })}
          {!teams.length && <p className="muted">Aucune équipe</p>}
        </div>
      </div>

      <div className="card">
        {!selected ? (
          <p className="muted">Sélectionnez une équipe</p>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>
              {selected.category_code ? `${selected.category_code} · ` : ""}
              {selected.name}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Coach titulaire + assistants. En séance, si le titulaire est absent → choisir un remplaçant.
            </p>

            <table>
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>Rôle</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {draft.map((d) => (
                  <tr key={d.user_id}>
                    <td>{coachName(d.user_id)}</td>
                    <td>
                      {canEdit ? (
                        <select
                          value={d.role_label}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "primary") setPrimary(d.user_id);
                            else
                              setDraft((rows) =>
                                rows.map((x) => (x.user_id === d.user_id ? { ...x, role_label: v } : x)),
                              );
                          }}
                        >
                          <option value="primary">Titulaire</option>
                          <option value="coach">Coach</option>
                          <option value="assistant">Assistant</option>
                        </select>
                      ) : (
                        <span className="badge">{d.role_label === "primary" ? "titulaire" : d.role_label}</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button type="button" className="danger" onClick={() => removeCoach(d.user_id)}>
                          Retirer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!draft.length && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Aucun coach assigné
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canEdit && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "end" }}>
                <div className="field" style={{ flex: 1, minWidth: 180, margin: 0 }}>
                  <label>Ajouter un coach</label>
                  <select value={addCoachId} onChange={(e) => setAddCoachId(e.target.value)}>
                    <option value="">—</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={addCoach} disabled={!addCoachId}>
                  Ajouter
                </button>
                <button type="button" className="accent" onClick={save} disabled={saving}>
                  {saving ? "…" : "Enregistrer"}
                </button>
              </div>
            )}
            {msg && <p className="error">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
