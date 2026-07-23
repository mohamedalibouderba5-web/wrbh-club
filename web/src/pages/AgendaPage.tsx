import { FormEvent, useEffect, useState } from "react";
import { api, loadAllSettled, mediaUrl } from "../api/client";
import { useI18n } from "../i18n";

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
};

type Team = { id: number; name: string };
type Roster = {
  athlete_id: number;
  full_name: string;
  photo_path?: string;
  attendance_status?: string;
};

export function AgendaPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [form, setForm] = useState({
    event_type: "training",
    title: "Entraînement",
    title_ar: "تدريب",
    starts_at: "",
    team_id: 0,
    opponent: "",
    home_away: "home",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const { data, errors } = await loadAllSettled<[EventRow[], Team[]]>([
        () => api<EventRow[]>("/api/v1/events?include_cancelled=true"),
        () => api<Team[]>("/api/v1/teams"),
      ]);
      const [e, tms] = data;
      if (e) setEvents(e);
      if (tms) {
        setTeams(tms);
        if (tms[0] && !form.team_id) setForm((f) => ({ ...f, team_id: tms[0].id }));
      }
      if (errors.length) setMsg(errors.join(" · "));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur chargement");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openSession(ev: EventRow) {
    setSelected(ev);
    setMsg("");
    if (ev.is_cancelled) {
      setRoster([]);
      return;
    }
    const rows = await api<Roster[]>(`/api/v1/events/${ev.id}/roster`);
    setRoster(rows);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      }),
    });
    load();
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

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px 1fr", gap: "1rem" }}>
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
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
        </div>
        <div className="field">
          <label>Équipe</label>
          <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: Number(e.target.value) })}>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
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
              </div>
              {!selected.is_cancelled && (
                <button type="button" className="accent" onClick={markAllPresent}>
                  Tous présents
                </button>
              )}
            </div>

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
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "present")}>{t("present")}</button>
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "absent")}>{t("absent")}</button>
                        <button type="button" onClick={() => setAttendance(r.athlete_id, "late")}>{t("late")}</button>
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
