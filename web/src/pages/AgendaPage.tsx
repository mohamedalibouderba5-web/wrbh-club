import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, loadAllSettled, mediaUrl } from "../api/client";
import { toast } from "../components/Toast";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";

type EventRow = {
  id: number;
  event_type: string;
  title: string;
  title_ar?: string;
  starts_at: string;
  opponent?: string;
  home_away?: string;
  team_id?: number;
  is_cancelled: boolean;
  description?: string;
  coach_id?: number | null;
  substitute_coach_id?: number | null;
  coach_name?: string;
  substitute_coach_name?: string;
};

type Team = { id: number; name: string };
type Coach = { id: number; full_name: string };
type TeamCoach = { user_id: number; role_label: string; coach_name?: string };
type Roster = {
  athlete_id: number;
  full_name: string;
  photo_path?: string;
  attendance_status?: string;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendaPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "direction" || role === "staff" || role === "coach";
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teamCoaches, setTeamCoaches] = useState<TeamCoach[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    event_type: "training",
    title: "Entraînement",
    title_ar: "تدريب",
    starts_at: "",
    team_id: 0,
    opponent: "",
    home_away: "home",
    coach_id: 0,
    substitute_coach_id: 0,
  });
  const [editForm, setEditForm] = useState({
    event_type: "training",
    title: "",
    title_ar: "",
    starts_at: "",
    team_id: 0,
    opponent: "",
    home_away: "home",
    coach_id: 0,
    substitute_coach_id: 0,
  });
  const [cancelReason, setCancelReason] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const { data, errors } = await loadAllSettled<[EventRow[], Team[], Coach[]]>([
        () => api<EventRow[]>("/api/v1/events?include_cancelled=true"),
        () => api<Team[]>("/api/v1/teams"),
        () => api<Coach[]>("/api/v1/coaches").catch(() => []),
      ]);
      const [e, tms, ch] = data;
      if (e) setEvents(e);
      if (tms) {
        setTeams(tms);
        if (tms[0] && !form.team_id) setForm((f) => ({ ...f, team_id: tms[0].id }));
      }
      if (ch) setCoaches(ch);
      if (errors.length) setMsg(errors.join(" · "));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur chargement");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadTeamCoaches(teamId: number) {
    if (!teamId) {
      setTeamCoaches([]);
      return;
    }
    try {
      const rows = await api<TeamCoach[]>(`/api/v1/teams/${teamId}/coaches`);
      setTeamCoaches(rows);
      const primary = rows.find((r) => r.role_label === "primary") || rows[0];
      if (primary) {
        setForm((f) => (f.team_id === teamId && !f.coach_id ? { ...f, coach_id: primary.user_id } : f));
      }
    } catch {
      setTeamCoaches([]);
    }
  }

  useEffect(() => {
    if (form.team_id) loadTeamCoaches(form.team_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.team_id]);

  const coachOptions = useMemo(() => {
    const map = new Map<number, string>();
    coaches.forEach((c) => map.set(c.id, c.full_name));
    teamCoaches.forEach((c) => {
      if (c.coach_name) map.set(c.user_id, c.coach_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [coaches, teamCoaches]);

  async function openSession(ev: EventRow) {
    setSelected(ev);
    setEditing(false);
    setMsg("");
    setEditForm({
      event_type: ev.event_type,
      title: ev.title,
      title_ar: ev.title_ar || "",
      starts_at: toLocalInput(ev.starts_at),
      team_id: ev.team_id || 0,
      opponent: ev.opponent || "",
      home_away: ev.home_away || "home",
      coach_id: ev.coach_id || 0,
      substitute_coach_id: ev.substitute_coach_id || 0,
    });
    if (ev.is_cancelled) {
      setRoster([]);
      return;
    }
    const rows = await api<Roster[]>(`/api/v1/events/${ev.id}/roster`);
    setRoster(rows);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({
          event_type: form.event_type,
          title: form.title,
          title_ar: form.title_ar || null,
          starts_at: new Date(form.starts_at).toISOString(),
          team_id: form.team_id || null,
          opponent: form.event_type === "match" ? form.opponent : null,
          home_away: form.event_type === "match" ? form.home_away : null,
          coach_id: form.coach_id || null,
          substitute_coach_id: form.substitute_coach_id || null,
        }),
      });
      toast("Séance créée", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function saveEdit() {
    if (!selected) return;
    try {
      const updated = await api<EventRow>(`/api/v1/events/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          event_type: editForm.event_type,
          title: editForm.title,
          title_ar: editForm.title_ar || null,
          starts_at: new Date(editForm.starts_at).toISOString(),
          team_id: editForm.team_id || null,
          opponent: editForm.event_type === "match" ? editForm.opponent : null,
          home_away: editForm.event_type === "match" ? editForm.home_away : null,
          coach_id: editForm.coach_id || null,
          substitute_coach_id: editForm.substitute_coach_id || null,
          clear_substitute: !editForm.substitute_coach_id,
        }),
      });
      toast("Séance modifiée", "success");
      setSelected(updated);
      setEditing(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function setAttendance(athleteId: number, status: string) {
    if (!selected) return;
    await api(`/api/v1/events/${selected.id}/attendance`, {
      method: "POST",
      body: JSON.stringify([{ athlete_id: athleteId, status }]),
    });
    setRoster((rows) => rows.map((r) => (r.athlete_id === athleteId ? { ...r, attendance_status: status } : r)));
  }

  async function markAllPresent() {
    if (!selected || !roster.length) return;
    await api(`/api/v1/events/${selected.id}/attendance`, {
      method: "POST",
      body: JSON.stringify(roster.map((r) => ({ athlete_id: r.athlete_id, status: "present" }))),
    });
    setRoster((rows) => rows.map((r) => ({ ...r, attendance_status: "present" })));
  }

  async function cancelSession() {
    if (!selected) return;
    await api(`/api/v1/events/${selected.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: cancelReason || "Séance annulée", notify: true }),
    });
    setMsg("Séance annulée — parents notifiés / تم إشعار الأولياء");
    setSelected(null);
    load();
  }

  const typeIcon: Record<string, string> = {
    training: "⚽",
    match: "🏆",
    meeting: "📋",
    camp: "⛺",
    gala: "✨",
  };

  function coachSelect(
    value: number,
    onChange: (v: number) => void,
    opts: { id: number; name: string }[],
    allowEmpty = true,
  ) {
    return (
      <select value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)}>
        {allowEmpty && <option value="">—</option>}
        {opts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px 1fr", gap: "1rem" }}>
      {canEdit && (
        <form className="card" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>Nouvelle séance</h3>
          <div className="field">
            <label>Type</label>
            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
              <option value="training">Entraînement / تدريب</option>
              <option value="match">Match / مباراة</option>
              <option value="meeting">Réunion</option>
              <option value="camp">Stage</option>
              <option value="gala">Gala</option>
            </select>
          </div>
          <div className="field">
            <label>Titre FR</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="field">
            <label>العنوان AR</label>
            <input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
          </div>
          <div className="field">
            <label>Début</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Équipe</label>
            <select
              value={form.team_id}
              onChange={(e) => setForm({ ...form, team_id: Number(e.target.value), coach_id: 0 })}
            >
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Coach (titulaire)</label>
            {coachSelect(form.coach_id, (v) => setForm({ ...form, coach_id: v }), coachOptions, false)}
          </div>
          <div className="field">
            <label>Remplaçant (si absence)</label>
            {coachSelect(
              form.substitute_coach_id,
              (v) => setForm({ ...form, substitute_coach_id: v }),
              coachOptions.filter((c) => c.id !== form.coach_id),
            )}
          </div>
          {form.event_type === "match" && (
            <>
              <div className="field">
                <label>Adversaire</label>
                <input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
              </div>
              <div className="field">
                <label>Domicile / Extérieur</label>
                <select value={form.home_away} onChange={(e) => setForm({ ...form, home_away: e.target.value })}>
                  <option value="home">Domicile</option>
                  <option value="away">Extérieur</option>
                </select>
              </div>
            </>
          )}
          <button type="submit">Créer</button>
        </form>
      )}

      <div className="grid" style={{ gap: "1rem" }}>
        <div className="session-board">
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              className={`session-card ${selected?.id === ev.id ? "selected" : ""} ${ev.is_cancelled ? "cancelled" : ""} type-${ev.event_type}`}
              onClick={() => openSession(ev)}
            >
              <div className="session-icon">{typeIcon[ev.event_type] || "•"}</div>
              <div className="session-body">
                <strong>{ev.title}</strong>
                {ev.title_ar && <div className="ar-line">{ev.title_ar}</div>}
                <div className="session-meta">
                  {new Date(ev.starts_at).toLocaleString("fr-DZ")}
                  {ev.opponent ? ` · vs ${ev.opponent}` : ""}
                </div>
                {(ev.coach_name || ev.substitute_coach_name) && (
                  <div className="session-meta">
                    {ev.substitute_coach_name
                      ? `Coach: ${ev.substitute_coach_name} (remplace ${ev.coach_name || "—"})`
                      : `Coach: ${ev.coach_name}`}
                  </div>
                )}
                <span className="badge">{ev.is_cancelled ? "annulé" : ev.event_type}</span>
              </div>
            </button>
          ))}
          {!events.length && <p style={{ color: "var(--muted)" }}>Aucune séance</p>}
        </div>

        {selected && (
          <div className="card session-panel">
            <div className="session-panel-head">
              <div>
                <h3 style={{ margin: 0 }}>{selected.title}</h3>
                {selected.title_ar && <div className="ar-line">{selected.title_ar}</div>}
                <div style={{ color: "var(--muted)" }}>{new Date(selected.starts_at).toLocaleString("fr-DZ")}</div>
                {(selected.coach_name || selected.substitute_coach_name) && (
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>
                    {selected.substitute_coach_name
                      ? `Coach: ${selected.substitute_coach_name} (remplaçant) · titulaire: ${selected.coach_name || "—"}`
                      : `Coach: ${selected.coach_name}`}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {canEdit && !selected.is_cancelled && (
                  <button type="button" onClick={() => setEditing((v) => !v)}>
                    {editing ? t("cancel") : t("edit")}
                  </button>
                )}
                {!selected.is_cancelled && (
                  <button type="button" className="accent" onClick={markAllPresent}>
                    Tous présents
                  </button>
                )}
              </div>
            </div>

            {editing && canEdit && !selected.is_cancelled && (
              <div style={{ marginBottom: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                <h4 style={{ marginTop: 0 }}>Modifier la séance</h4>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>Type</label>
                    <select
                      value={editForm.event_type}
                      onChange={(e) => setEditForm({ ...editForm, event_type: e.target.value })}
                    >
                      <option value="training">Entraînement</option>
                      <option value="match">Match</option>
                      <option value="meeting">Réunion</option>
                      <option value="camp">Stage</option>
                      <option value="gala">Gala</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Début</label>
                    <input
                      type="datetime-local"
                      value={editForm.starts_at}
                      onChange={(e) => setEditForm({ ...editForm, starts_at: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Titre FR</label>
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>العنوان AR</label>
                    <input
                      value={editForm.title_ar}
                      onChange={(e) => setEditForm({ ...editForm, title_ar: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Équipe</label>
                    <select
                      value={editForm.team_id}
                      onChange={(e) => setEditForm({ ...editForm, team_id: Number(e.target.value) })}
                    >
                      {teams.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Coach</label>
                    {coachSelect(
                      editForm.coach_id,
                      (v) => setEditForm({ ...editForm, coach_id: v }),
                      coaches.map((c) => ({ id: c.id, name: c.full_name })),
                      false,
                    )}
                  </div>
                  <div className="field">
                    <label>Remplaçant</label>
                    {coachSelect(
                      editForm.substitute_coach_id,
                      (v) => setEditForm({ ...editForm, substitute_coach_id: v }),
                      coaches
                        .filter((c) => c.id !== editForm.coach_id)
                        .map((c) => ({ id: c.id, name: c.full_name })),
                    )}
                  </div>
                </div>
                <button type="button" className="accent" onClick={saveEdit}>
                  {t("save")}
                </button>
              </div>
            )}

            {selected.is_cancelled ? (
              <p className="error">Séance annulée — {selected.description}</p>
            ) : (
              <>
                <h4>{t("attendance")}</h4>
                <div className="roster-grid">
                  {roster.map((r) => (
                    <div key={r.athlete_id} className={`roster-card att-${r.attendance_status || "none"}`}>
                      {r.photo_path ? (
                        <img src={mediaUrl(r.photo_path)} alt="" />
                      ) : (
                        <div className="roster-avatar">{r.full_name.slice(0, 1)}</div>
                      )}
                      <strong>{r.full_name}</strong>
                      <div className="att-btns">
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "present")}>
                          {t("present")}
                        </button>
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "absent")}>
                          {t("absent")}
                        </button>
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "late")}>
                          {t("late")}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!roster.length && <p style={{ color: "var(--muted)" }}>Aucun joueur dans l'équipe</p>}
                </div>

                <div className="cancel-box">
                  <h4>{t("cancelSession")}</h4>
                  <input
                    placeholder="Motif / السبب"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <button type="button" className="danger" onClick={cancelSession}>
                    Annuler + notifier parents
                  </button>
                </div>
              </>
            )}
            {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
