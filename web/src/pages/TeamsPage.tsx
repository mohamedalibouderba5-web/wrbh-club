import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, loadAllSettled } from "../api/client";
import { toast } from "../components/Toast";
import { useAuth } from "../auth";

type Coach = {
  id: number;
  full_name: string;
  full_name_ar?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
};
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

const emptyCoachForm = {
  full_name: "",
  full_name_ar: "",
  phone: "",
  email: "",
  password: "",
};

export function TeamsPage() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "direction" || role === "staff";
  const canManageCoaches = role === "admin" || role === "direction";
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ user_id: number; role_label: string }[]>([]);
  const [addCoachId, setAddCoachId] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [coachForm, setCoachForm] = useState(emptyCoachForm);
  const [editCoachId, setEditCoachId] = useState<number | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  async function load() {
    try {
      const { data, errors } = await loadAllSettled<[TeamRow[], Coach[]]>([
        () => api<TeamRow[]>("/api/v1/teams/coaches"),
        () => api<Coach[]>(`/api/v1/coaches?include_inactive=${canManageCoaches ? "true" : "false"}`),
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

  const activeCoaches = useMemo(() => coaches.filter((c) => c.is_active !== false), [coaches]);

  const available = useMemo(
    () => activeCoaches.filter((c) => !draft.some((d) => d.user_id === c.id)),
    [activeCoaches, draft],
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
    if (!selectedId || saving) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/v1/teams/${selectedId}/coaches`, {
        method: "PUT",
        body: JSON.stringify({ coaches: draft }),
      });
      toast("Coachs de l'équipe enregistrés", "success");
      await load();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setMsg(m);
      toast(m, "error");
    } finally {
      setSaving(false);
    }
  }

  function startEditCoach(c: Coach) {
    setEditCoachId(c.id);
    setTempPassword("");
    setCoachForm({
      full_name: c.full_name || "",
      full_name_ar: c.full_name_ar || "",
      phone: c.phone || "",
      email: c.email || "",
      password: "",
    });
  }

  function resetCoachForm() {
    setEditCoachId(null);
    setCoachForm(emptyCoachForm);
    setTempPassword("");
  }

  async function onCreateCoach(e: FormEvent) {
    e.preventDefault();
    if (!canManageCoaches || coachBusy) return;
    if (!coachForm.full_name.trim()) {
      toast("Nom du coach obligatoire", "error");
      return;
    }
    setCoachBusy(true);
    setMsg("");
    try {
      if (editCoachId) {
        const body: Record<string, unknown> = {
          full_name: coachForm.full_name.trim(),
          full_name_ar: coachForm.full_name_ar.trim() || null,
          phone: coachForm.phone.trim() || null,
          email: coachForm.email.trim() || null,
        };
        if (coachForm.password.trim()) body.password = coachForm.password.trim();
        await api(`/api/v1/auth/users/${editCoachId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast("Coach modifié", "success");
        resetCoachForm();
      } else {
        const pwd =
          coachForm.password.trim() ||
          `Coach${Math.floor(1000 + Math.random() * 9000)}!`;
        await api("/api/v1/auth/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: coachForm.full_name.trim(),
            full_name_ar: coachForm.full_name_ar.trim() || null,
            phone: coachForm.phone.trim() || null,
            email: coachForm.email.trim() || null,
            role: "coach",
            password: pwd,
            locale: "fr",
          }),
        });
        setCoachForm(emptyCoachForm);
        setEditCoachId(null);
        setTempPassword(pwd);
        toast("Coach ajouté — liez-le à une équipe ci-dessous", "success");
      }
      await load();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setMsg(m);
      toast(m, "error");
    } finally {
      setCoachBusy(false);
    }
  }

  async function toggleCoachActive(c: Coach) {
    if (!canManageCoaches) return;
    const next = c.is_active === false;
    const label = next ? "réactiver" : "désactiver (archiver)";
    if (!window.confirm(`${label} le coach « ${c.full_name} » ?`)) return;
    try {
      await api(`/api/v1/auth/users/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: next }),
      });
      toast(next ? "Coach réactivé" : "Coach archivé (désactivé)", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function syncStructure() {
    if (!canManageCoaches || syncBusy) return;
    if (
      !window.confirm(
        "Créer / compléter les équipes du club ?\nU14G1, U14G2, U13G1, U13G2, U11G1, U11G2, U9G1, U9G2, U7G1, U5G1",
      )
    ) {
      return;
    }
    setSyncBusy(true);
    try {
      const res = await api<{
        teams_created: number;
        categories_created: number;
        updated: number;
      }>("/api/v1/teams/sync-structure", { method: "POST" });
      toast(
        `Équipes OK — +${res.teams_created} équipes, +${res.categories_created} catégories`,
        "success",
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur sync", "error");
    } finally {
      setSyncBusy(false);
    }
  }

  async function repairCoachAgenda() {
    if (!canManageCoaches || syncBusy) return;
    setSyncBusy(true);
    try {
      const res = await api<{ events_updated: number; teams_with_coach: number }>(
        "/api/v1/teams/backfill-event-coaches",
        { method: "POST" },
      );
      toast(
        `Agenda coachs réparé — ${res.events_updated} séance(s) liées · ${res.teams_with_coach} équipe(s)`,
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {canManageCoaches && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Coachs / المدربون</h3>
              <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                Ajouter ou modifier un coach comme pour un joueur, puis l’assigner à une équipe (U14G1, U11G2…).
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="accent" disabled={syncBusy} onClick={() => void syncStructure()}>
                {syncBusy ? "…" : "Créer équipes U14G1…U5G1"}
              </button>
              <button type="button" className="secondary" disabled={syncBusy} onClick={() => void repairCoachAgenda()}>
                Réparer agenda coachs
              </button>
            </div>
          </div>

          <form className="grid" style={{ gap: "0.75rem", marginTop: "1rem" }} onSubmit={onCreateCoach}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Nom complet *</label>
                <input
                  required
                  value={coachForm.full_name}
                  onChange={(e) => setCoachForm({ ...coachForm, full_name: e.target.value })}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Nom arabe</label>
                <input
                  value={coachForm.full_name_ar}
                  onChange={(e) => setCoachForm({ ...coachForm, full_name_ar: e.target.value })}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Téléphone</label>
                <input
                  className="ltr"
                  inputMode="tel"
                  placeholder="05XXXXXXXX"
                  value={coachForm.phone}
                  onChange={(e) => setCoachForm({ ...coachForm, phone: e.target.value })}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Email (optionnel)</label>
                <input
                  className="ltr"
                  type="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>{editCoachId ? "Nouveau mot de passe" : "Mot de passe (auto si vide)"}</label>
                <input
                  className="ltr"
                  type="text"
                  autoComplete="new-password"
                  value={coachForm.password}
                  onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" disabled={coachBusy}>
                {coachBusy ? "…" : editCoachId ? "Enregistrer le coach" : "Ajouter un coach"}
              </button>
              {editCoachId && (
                <button type="button" className="secondary" onClick={resetCoachForm}>
                  Annuler
                </button>
              )}
            </div>
            {tempPassword && (
              <p style={{ color: "var(--ok)", margin: 0 }}>
                Mot de passe temporaire : <strong className="ltr">{tempPassword}</strong> — à communiquer au coach.
              </p>
            )}
          </form>

          <table style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Tél.</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id} style={{ opacity: c.is_active === false ? 0.55 : 1 }}>
                  <td>
                    {c.full_name}
                    {c.full_name_ar ? ` · ${c.full_name_ar}` : ""}
                  </td>
                  <td className="ltr">{c.phone || "—"}</td>
                  <td>
                    <span className="badge">{c.is_active === false ? "archivé" : "actif"}</span>
                  </td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="secondary" onClick={() => startEditCoach(c)}>
                      Modifier
                    </button>
                    <button type="button" className="danger" onClick={() => void toggleCoachActive(c)}>
                      {c.is_active === false ? "Réactiver" : "Archiver"}
                    </button>
                  </td>
                </tr>
              ))}
              {!coaches.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aucun coach — ajoutez-en un ci-dessus
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="split-layout">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Équipes / الفرق</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Chaque catégorie a son coach. Un coach peut entraîner plusieurs équipes (ex. U11G1 + U14G2).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teams.map((t) => {
              const primary = t.coaches.find((c) => c.role_label === "primary") || t.coaches[0];
              const active = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTeam(t)}
                  style={{
                    textAlign: "left",
                    padding: "0.85rem 1rem",
                    borderRadius: 12,
                    border: active ? "2px solid #F5C518" : "1px solid transparent",
                    background: active ? "#F5C518" : "#1E3A8A",
                    color: active ? "#0f172a" : "#fff",
                    fontWeight: 600,
                  }}
                >
                  <div>
                    {t.category_code || "?"} · {t.name}
                  </div>
                  <div style={{ fontSize: "0.85em", opacity: 0.9, fontWeight: 500 }}>
                    {primary?.coach_name || "Sans coach"}
                  </div>
                </button>
              );
            })}
            {!teams.length && <p className="muted">Aucune équipe — utilisez « Créer équipes U14G1…U5G1 ».</p>}
          </div>
        </div>

        <div className="card">
          {!selected ? (
            <p className="muted">Sélectionnez une équipe</p>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>
                {selected.category_code} — {selected.name}
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Coach titulaire + assistants. En séance, si le titulaire est absent — choisir un remplaçant.
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
                  {draft.map((d) => {
                    const c = coaches.find((x) => x.id === d.user_id);
                    return (
                      <tr key={d.user_id}>
                        <td>{c?.full_name || `#${d.user_id}`}</td>
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
                    );
                  })}
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
                  <button type="button" className="accent" onClick={() => void save()} disabled={saving}>
                    {saving ? "…" : "Enregistrer"}
                  </button>
                </div>
              )}
              {msg && <p className="error">{msg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
