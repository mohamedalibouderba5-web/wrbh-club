import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type EventRow = {
  id: number;
  event_type: string;
  title: string;
  starts_at: string;
  opponent?: string;
  home_away?: string;
  team_id?: number;
};

type Team = { id: number; name: string };

export function AgendaPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState({
    event_type: "training",
    title: "Entraînement",
    starts_at: "",
    team_id: 0,
    opponent: "",
    home_away: "home",
  });

  async function load() {
    const [e, t] = await Promise.all([
      api<EventRow[]>("/api/v1/events"),
      api<Team[]>("/api/v1/teams"),
    ]);
    setEvents(e);
    setTeams(t);
    if (t[0] && !form.team_id) setForm((f) => ({ ...f, team_id: t[0].id }));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/events", {
      method: "POST",
      body: JSON.stringify({
        event_type: form.event_type,
        title: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        team_id: form.team_id || null,
        opponent: form.event_type === "match" ? form.opponent : null,
        home_away: form.event_type === "match" ? form.home_away : null,
      }),
    });
    load();
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", gap: "1rem" }}>
      <form className="card" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>Nouvel événement</h3>
        <div className="field"><label>Type</label>
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
            <option value="training">Entraînement</option>
            <option value="match">Match</option>
            <option value="meeting">Réunion</option>
            <option value="camp">Stage</option>
            <option value="gala">Gala</option>
          </select></div>
        <div className="field"><label>Titre</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field"><label>Début</label>
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required /></div>
        <div className="field"><label>Équipe</label>
          <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: Number(e.target.value) })}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        {form.event_type === "match" && (
          <>
            <div className="field"><label>Adversaire</label>
              <input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} /></div>
            <div className="field"><label>Domicile / Extérieur</label>
              <select value={form.home_away} onChange={(e) => setForm({ ...form, home_away: e.target.value })}>
                <option value="home">Domicile</option>
                <option value="away">Extérieur</option>
              </select></div>
          </>
        )}
        <button type="submit">Créer</button>
      </form>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Calendrier</h3>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Détail</th></tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{new Date(ev.starts_at).toLocaleString("fr-DZ")}</td>
                <td><span className="badge">{ev.event_type}</span></td>
                <td>{ev.title}</td>
                <td>{ev.opponent ? `${ev.home_away} vs ${ev.opponent}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
