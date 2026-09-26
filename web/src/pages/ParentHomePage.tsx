import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDateFr } from "../api/client";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { toast } from "../components/Toast";

type Child = {
  id: number;
  full_name: string;
  birth_date?: string | null;
  status: string;
  category_code?: string | null;
  photo_path?: string | null;
};

type EventRow = {
  id: number;
  title: string;
  event_type: string;
  starts_at: string;
  location_text?: string | null;
  session_status?: string | null;
  approval_status?: string | null;
  is_cancelled?: boolean;
};

type Notif = {
  id: number;
  title: string;
  body?: string | null;
  kind?: string | null;
  is_read?: boolean;
  created_at?: string;
};

type Prefs = {
  notify_on_create: boolean;
  notify_on_start: boolean;
  notify_on_end: boolean;
  notify_on_attendance: boolean;
  notify_on_cancel: boolean;
  remind_minutes_before: number;
  remind_day_before: boolean;
  user_id?: number;
};

type Home = {
  role: string;
  full_name: string;
  club_name: string;
  children_count: number;
  children: Child[];
  upcoming_events: EventRow[];
  pending_convocations: number;
  unpaid_installments: number;
  announcements: { id: number; title: string }[];
};

const SESSION_LABEL: Record<string, { fr: string; ar: string }> = {
  scheduled: { fr: "Planifiée", ar: "مجدولة" },
  in_progress: { fr: "En cours", ar: "جارية" },
  completed: { fr: "Terminée", ar: "منتهية" },
  cancelled: { fr: "Annulée", ar: "ملغاة" },
};

const emptyPrefs: Prefs = {
  notify_on_create: true,
  notify_on_start: true,
  notify_on_end: true,
  notify_on_attendance: true,
  notify_on_cancel: true,
  remind_minutes_before: 60,
  remind_day_before: true,
};

export function ParentHomePage() {
  const { fullName } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [home, setHome] = useState<Home | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(emptyPrefs);
  const [showPrefs, setShowPrefs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPrefs, setBusyPrefs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, n, p] = await Promise.all([
        api<Home>("/api/v1/mobile/home"),
        api<Notif[]>("/api/v1/notifications").catch(() => [] as Notif[]),
        api<Prefs>("/api/v1/parent/notification-prefs").catch(() => emptyPrefs),
      ]);
      setHome(h);
      setNotifs(Array.isArray(n) ? n.slice(0, 8) : []);
      setPrefs(p || emptyPrefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrefs() {
    setBusyPrefs(true);
    try {
      const body = {
        notify_on_create: prefs.notify_on_create,
        notify_on_start: prefs.notify_on_start,
        notify_on_end: prefs.notify_on_end,
        notify_on_attendance: prefs.notify_on_attendance,
        notify_on_cancel: prefs.notify_on_cancel,
        remind_minutes_before: prefs.remind_minutes_before,
        remind_day_before: prefs.remind_day_before,
      };
      const saved = await api<Prefs>("/api/v1/parent/notification-prefs", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setPrefs(saved);
      toast(ar ? "تم حفظ التفضيلات" : "Préférences enregistrées", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setBusyPrefs(false);
    }
  }

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

  const children = home?.children || [];
  const events = home?.upcoming_events || [];

  return (
    <div className="stack parent-home">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {ar ? `مرحباً${fullName ? `، ${fullName}` : ""}` : `Bonjour${fullName ? `, ${fullName}` : ""}`}
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {ar
            ? "متابعة أبنائك: الحصص، الإشعارات والاشتراكات. لا يمكنك إنشاء أو تعديل الحصص — ذلك خاص بالمدرب والإدارة."
            : "Suivi de vos enfants : séances, notifications et cotisations. Vous ne pouvez ni créer ni modifier une séance — réservé aux coachs et à l’administration."}
        </p>
        <div className="parent-kpi-row">
          <div className="parent-kpi">
            <strong>{home?.children_count ?? children.length}</strong>
            <span>{ar ? "أبناء" : "Enfants"}</span>
          </div>
          <div className="parent-kpi">
            <strong>{events.length}</strong>
            <span>{ar ? "حصص قادمة" : "Séances à venir"}</span>
          </div>
          <div className="parent-kpi">
            <strong>{home?.pending_convocations ?? 0}</strong>
            <span>{ar ? "دعوات بانتظار" : "Convocations"}</span>
          </div>
          <div className="parent-kpi warn">
            <strong>{home?.unpaid_installments ?? 0}</strong>
            <span>{ar ? "مستحقات" : "Impayés"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Link className="button secondary" to="/agenda">
            {ar ? "جدول الحصص" : "Voir l’agenda"}
          </Link>
          <Link className="button secondary" to="/registrations">
            {ar ? "التسجيلات" : "Inscriptions"}
          </Link>
          <Link className="button secondary" to="/download">
            {ar ? "تطبيق أندرويد" : "Application Android"}
          </Link>
          <button type="button" className="secondary" onClick={() => setShowPrefs((v) => !v)}>
            {ar ? "تفضيلات الإشعارات" : "Préférences notifications"}
          </button>
        </div>
      </div>

      {showPrefs && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{ar ? "ماذا تريد أن تستلم؟" : "Que souhaitez-vous recevoir ?"}</h3>
          <div className="parent-prefs-grid">
            {(
              [
                ["notify_on_create", ar ? "إنشاء حصة" : "Création de séance"],
                ["notify_on_start", ar ? "بداية الحصة" : "Démarrage séance"],
                ["notify_on_end", ar ? "نهاية الحصة" : "Fin de séance"],
                ["notify_on_attendance", ar ? "الحضور" : "Présence / absence"],
                ["notify_on_cancel", ar ? "إلغاء" : "Annulation"],
                ["remind_day_before", ar ? "تذكير قبل يوم" : "Rappel la veille"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="parent-pref-row">
                <input
                  type="checkbox"
                  checked={!!prefs[key]}
                  onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
            <label className="field" style={{ margin: 0 }}>
              {ar ? "تذكير قبل (دقائق)" : "Rappel avant (minutes)"}
              <select
                className="ltr"
                value={prefs.remind_minutes_before}
                onChange={(e) =>
                  setPrefs({ ...prefs, remind_minutes_before: Number(e.target.value) || 60 })
                }
              >
                {[30, 60, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" disabled={busyPrefs} onClick={() => void savePrefs()} style={{ marginTop: 12 }}>
            {busyPrefs ? "…" : ar ? "حفظ" : "Enregistrer"}
          </button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "أبنائي" : "Mes enfants"}</h3>
        {!children.length && (
          <p className="muted">
            {ar
              ? "لا يوجد أبناء مرتبطون بهذا الحساب. اطلب من الإدارة ربط اللاعبين."
              : "Aucun enfant lié à ce compte. Demandez à l’administration de lier les athlètes."}
          </p>
        )}
        <div className="parent-children-grid">
          {children.map((c) => (
            <div key={c.id} className="parent-child-card">
              <strong>{c.full_name}</strong>
              <span className="muted">
                {c.category_code || "—"}
                {c.birth_date ? ` · ${formatDateFr(c.birth_date)}` : ""}
              </span>
              <span className="badge">{c.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "الحصص القادمة" : "Prochaines séances"}</h3>
        {!events.length && <p className="muted">{ar ? "لا حصص قادمة" : "Aucune séance à venir"}</p>}
        <ul className="parent-event-list">
          {events.map((ev) => {
            const st = ev.is_cancelled ? "cancelled" : ev.session_status || "scheduled";
            const lab = SESSION_LABEL[st] || SESSION_LABEL.scheduled;
            return (
              <li key={ev.id}>
                <div>
                  <strong>{ev.title}</strong>
                  <span className="muted">
                    {" "}
                    · {ev.event_type} · {formatDateFr(ev.starts_at)}
                  </span>
                  {ev.location_text ? <div className="muted">📍 {ev.location_text}</div> : null}
                </div>
                <span className={`badge session-${st}`}>{ar ? lab.ar : lab.fr}</span>
              </li>
            );
          })}
        </ul>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          {ar
            ? "الحدود: مشاهدة فقط + الرد على الدعوات. بدون إنشاء / حضور / حذف."
            : "Limites : consultation + réponse aux convocations. Pas de création, pointage ni suppression."}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "آخر الإشعارات" : "Dernières notifications"}</h3>
        {!notifs.length && <p className="muted">{ar ? "لا إشعارات" : "Aucune notification"}</p>}
        <ul className="parent-event-list">
          {notifs.map((n) => (
            <li key={n.id} style={{ opacity: n.is_read ? 0.7 : 1 }}>
              <div>
                <strong>{n.title}</strong>
                {n.body ? <div className="muted">{n.body}</div> : null}
              </div>
              {n.kind ? <span className="badge">{n.kind}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      {(home?.announcements?.length || 0) > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{ar ? "إعلانات النادي" : "Annonces du club"}</h3>
          <ul>
            {home!.announcements.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
          <Link to="/announcements">{ar ? "كل الإعلانات" : "Toutes les annonces"}</Link>
        </div>
      )}
    </div>
  );
}
