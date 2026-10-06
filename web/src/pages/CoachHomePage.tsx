import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDateFr, loadAllSettled } from "../api/client";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { roleSpaceTitle } from "../roles/access";

type MyTeam = {
  team_id: number;
  name: string;
  code?: string | null;
  role_label?: string;
  category_id?: number;
};

type EventRow = {
  id: number;
  title: string;
  title_ar?: string;
  event_type: string;
  starts_at: string;
  location_text?: string | null;
  session_status?: string | null;
  approval_status?: string | null;
  is_cancelled?: boolean;
  team_id?: number | null;
  coach_name?: string | null;
};

const SESSION_LABEL: Record<string, { fr: string; ar: string }> = {
  scheduled: { fr: "Planifiée", ar: "مجدولة" },
  in_progress: { fr: "En cours", ar: "جارية" },
  completed: { fr: "Terminée", ar: "منتهية" },
  cancelled: { fr: "Annulée", ar: "ملغاة" },
  pending_approval: { fr: "En attente validation", ar: "بانتظار الاعتماد" },
};

export function CoachHomePage() {
  const { fullName, role } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, errors } = await loadAllSettled<[{ teams: MyTeam[] }, EventRow[]]>([
      () => api<{ teams: MyTeam[] }>("/api/v1/coach/my-teams").catch(() => ({ teams: [] })),
      () => api<EventRow[]>("/api/v1/events?include_cancelled=false").catch(() => []),
    ]);
    if (data[0]?.teams) setTeams(data[0].teams);
    if (data[1]) setEvents(data[1]);
    if (errors.length && !data[0] && !data[1]) setError(errors.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => !e.is_cancelled && new Date(e.starts_at).getTime() >= now - 2 * 3600_000)
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
      .slice(0, 12);
  }, [events]);

  const todayCount = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return upcoming.filter((e) => {
      const x = new Date(e.starts_at);
      return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` === key;
    }).length;
  }, [upcoming]);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">{ar ? "جاري التحميل…" : "Chargement…"}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <button type="button" className="secondary" onClick={() => void load()}>
          {ar ? "إعادة المحاولة" : "Réessayer"}
        </button>
      </div>
    );
  }

  return (
    <div className="stack role-home coach-home">
      <div className="card role-home-hero">
        <div className="badge role-space-badge">{roleSpaceTitle(role, lang)}</div>
        <h2 style={{ marginTop: 8, marginBottom: 4 }}>
          {ar ? `مرحباً${fullName ? `، ${fullName}` : ""}` : `Bonjour${fullName ? `, ${fullName}` : ""}`}
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {ar
            ? "مساحتك: فرقك، الحصص، والحضور. لا مالية النادي ولا حسابات المستخدمين."
            : "Votre espace : vos équipes, séances et présences. Pas de finance club ni de comptes utilisateurs."}
        </p>
        <div className="parent-kpi-row">
          <div className="parent-kpi">
            <strong>{teams.length}</strong>
            <span>{ar ? "فرق" : "Équipes"}</span>
          </div>
          <div className="parent-kpi">
            <strong>{todayCount}</strong>
            <span>{ar ? "اليوم" : "Aujourd’hui"}</span>
          </div>
          <div className="parent-kpi">
            <strong>{upcoming.length}</strong>
            <span>{ar ? "قادمة" : "À venir"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Link className="button accent" to="/agenda">
            {ar ? "الأجندة / الحضور" : "Agenda / Présences"}
          </Link>
          <Link className="button secondary" to="/teams">
            {ar ? "فرقي" : "Mes équipes"}
          </Link>
          <Link className="button secondary" to="/athletes">
            {ar ? "اللاعبون" : "Athlètes"}
          </Link>
          <Link className="button secondary" to="/announcements">
            {ar ? "الإعلانات" : "Annonces"}
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "فرقي" : "Mes équipes"}</h3>
        {!teams.length && (
          <p className="muted">
            {ar
              ? "لا توجد فرق مرتبطة. اطلب من الإدارة تعيينك (U11G1…)."
              : "Aucune équipe liée. Demandez à l’administration de vous assigner (U11G1…)."}
          </p>
        )}
        <div className="coach-teams-grid">
          {teams.map((tm) => (
            <div key={tm.team_id} className="coach-team-card">
              <strong>{tm.code || tm.name}</strong>
              <span className="muted">{tm.name}</span>
              <span className="badge">{tm.role_label || "coach"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "الحصص القادمة" : "Prochaines séances"}</h3>
        {!upcoming.length && <p className="muted">{ar ? "لا حصص" : "Aucune séance"}</p>}
        <ul className="parent-event-list">
          {upcoming.map((ev) => {
            const st = ev.is_cancelled ? "cancelled" : ev.session_status || "scheduled";
            const lab = SESSION_LABEL[st] || SESSION_LABEL.scheduled;
            const appr =
              ev.approval_status === "pending_approval"
                ? SESSION_LABEL.pending_approval
                : null;
            return (
              <li key={ev.id}>
                <div>
                  <strong>{ar && ev.title_ar ? ev.title_ar : ev.title}</strong>
                  <span className="muted">
                    {" "}
                    · {ev.event_type} · {formatDateFr(ev.starts_at)}
                  </span>
                  {ev.location_text ? <div className="muted">📍 {ev.location_text}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {appr && <span className="badge">{ar ? appr.ar : appr.fr}</span>}
                  <span className={`badge session-${st}`}>{ar ? lab.ar : lab.fr}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          {ar
            ? "مسموح: إنشاء/تعديل حصص فرقك، الحضور، الإلغاء. ممنوع: مالية النادي، الحسابات، الأرشيف العام."
            : "Autorisé : créer/modifier séances de vos équipes, présences, annulation. Interdit : finance club, comptes, corbeille globale."}
        </p>
        <Link to="/agenda" style={{ display: "inline-block", marginTop: 10 }}>
          {ar ? "فتح الأجندة الكاملة →" : "Ouvrir l’agenda complet →"}
        </Link>
      </div>
    </div>
  );
}
