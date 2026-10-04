import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Navigate } from "react-router-dom";

type ClubRow = {
  id: number;
  slug: string;
  name: string;
  name_ar?: string | null;
  plan?: string | null;
  status?: string | null;
  sport?: string | null;
  is_platform?: boolean;
  trial_ends_on?: string | null;
  athletes_count: number;
  users_count?: number;
  online_count?: number;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

type UserRow = {
  id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  is_active: boolean;
  club_id?: number | null;
  club_slug?: string | null;
  club_name?: string | null;
  last_seen_at?: string | null;
  online: boolean;
};

type Dashboard = {
  generated_at: string;
  online_window_minutes: number;
  clubs: {
    total: number;
    active: number;
    suspended: number;
    trialish: number;
    trials_expiring_7d: number;
    by_plan: Record<string, number>;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    by_role: Record<string, number>;
    online: number;
    online_by_role: Record<string, number>;
  };
  activity: {
    athletes_total: number;
    registrations_total: number;
    registrations_month: number;
    payments_total: number;
    payments_month: number;
    payments_amount_month: number;
  };
  recent_clubs: ClubRow[];
  online_users: UserRow[];
};

type Tab = "overview" | "clubs" | "users";

const ROLE_ORDER = ["superadmin", "admin", "direction", "staff", "coach", "parent", "player"];

function fmtNum(n: number | undefined | null) {
  return new Intl.NumberFormat("fr-DZ").format(n || 0);
}

function fmtMoney(n: number | undefined | null) {
  return `${fmtNum(Math.round(n || 0))} DZD`;
}

function roleLabel(role: string, lang: string) {
  const fr: Record<string, string> = {
    superadmin: "Super-admin",
    admin: "Admin club",
    direction: "Direction",
    staff: "Staff",
    coach: "Coach",
    parent: "Parent",
    player: "Joueur",
  };
  const ar: Record<string, string> = {
    superadmin: "مشرف المنصة",
    admin: "مدير النادي",
    direction: "إدارة",
    staff: "طاقم",
    coach: "مدرب",
    parent: "ولي",
    player: "لاعب",
  };
  return (lang === "ar" ? ar : fr)[role] || role;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card" style={{ margin: 0, minWidth: 140 }}>
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
      {hint ? (
        <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function SuperAdminPage() {
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadDash = useCallback(async () => {
    const d = await api<Dashboard>("/api/v1/admin/dashboard");
    setDash(d);
  }, []);

  const loadClubs = useCallback(async () => {
    const rows = await api<ClubRow[]>("/api/v1/admin/clubs");
    setClubs(rows);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    if (onlineOnly) params.set("online_only", "true");
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "200");
    const res = await api<{ items: UserRow[] }>(`/api/v1/admin/users?${params}`);
    setUsers(res.items || []);
  }, [roleFilter, onlineOnly, q]);

  const refresh = useCallback(async () => {
    if (role !== "superadmin") return;
    setLoading(true);
    setError("");
    try {
      await loadDash();
      if (tab === "clubs") await loadClubs();
      if (tab === "users") await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toastError"));
    } finally {
      setLoading(false);
    }
  }, [role, tab, loadDash, loadClubs, loadUsers, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (role !== "superadmin" || tab !== "overview") return;
    const id = window.setInterval(() => {
      void loadDash().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [role, tab, loadDash]);

  async function toggleStatus(row: ClubRow) {
    const next = (row.status || "").toLowerCase() === "suspended" ? "active" : "suspended";
    const label =
      next === "suspended"
        ? lang === "ar"
          ? "تعليق النادي؟"
          : "Suspendre ce club ?"
        : lang === "ar"
          ? "إعادة تفعيل النادي؟"
          : "Réactiver ce club ?";
    if (!window.confirm(`${label}\n${row.name} (${row.slug})`)) return;
    setBusyId(row.id);
    setMsg("");
    setError("");
    try {
      const updated = await api<ClubRow>(`/api/v1/admin/clubs/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setClubs((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      setMsg(next === "suspended" ? t("platformSuspendedOk") : t("platformReactivatedOk"));
      await loadDash();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toastError"));
    } finally {
      setBusyId(null);
    }
  }

  async function setPlan(row: ClubRow, plan: string) {
    setBusyId(row.id);
    setError("");
    try {
      const updated = await api<ClubRow>(`/api/v1/admin/clubs/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
      setClubs((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      setMsg(lang === "ar" ? "تم تحديث الخطة" : "Plan mis à jour");
      await loadDash();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toastError"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleUserActive(row: UserRow) {
    const next = !row.is_active;
    const label = next
      ? lang === "ar"
        ? "تفعيل الحساب؟"
        : "Réactiver ce compte ?"
      : lang === "ar"
        ? "تعطيل الحساب؟"
        : "Désactiver ce compte ?";
    if (!window.confirm(`${label}\n${row.full_name}`)) return;
    setBusyId(row.id);
    setError("");
    try {
      const updated = await api<UserRow>(`/api/v1/admin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: next }),
      });
      setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, ...updated } : u)));
      setMsg(next ? (lang === "ar" ? "تم التفعيل" : "Compte activé") : lang === "ar" ? "تم التعطيل" : "Compte désactivé");
      await loadDash();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toastError"));
    } finally {
      setBusyId(null);
    }
  }

  const roleBreakdown = useMemo(() => {
    const src = dash?.users.by_role || {};
    return ROLE_ORDER.filter((r) => src[r] != null).map((r) => ({
      role: r,
      n: src[r] || 0,
      online: dash?.users.online_by_role?.[r] || 0,
    }));
  }, [dash]);

  if (role !== "superadmin") {
    return <Navigate to="/" replace />;
  }

  const tabs: { id: Tab; fr: string; ar: string }[] = [
    { id: "overview", fr: "Tableau de bord", ar: "لوحة التحكم" },
    { id: "clubs", fr: "Clubs / clients", ar: "الأندية / العملاء" },
    { id: "users", fr: "Comptes & présence", ar: "الحسابات والحضور" },
  ];

  return (
    <div className="grid" style={{ gap: "1rem" }} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>{t("platformAdmin")}</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {lang === "ar"
                ? "إدارة منصة Nadi Connect — كل الأندية والحسابات والحضور"
                : "Administration plateforme Nadi Connect — clubs, comptes, présence"}
            </p>
          </div>
          <button type="button" className="secondary" onClick={() => void refresh()} disabled={loading}>
            {lang === "ar" ? "تحديث" : "Actualiser"}
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              className={tab === tb.id ? "" : "secondary"}
              onClick={() => setTab(tb.id)}
            >
              {lang === "ar" ? tb.ar : tb.fr}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      {loading && !dash && <p className="muted">{t("loading")}</p>}

      {tab === "overview" && dash && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" }}>
            <Kpi label={lang === "ar" ? "أندية" : "Clubs"} value={fmtNum(dash.clubs.total)} hint={`${fmtNum(dash.clubs.active)} ${lang === "ar" ? "نشط" : "actifs"}`} />
            <Kpi label={lang === "ar" ? "معلق" : "Suspendus"} value={fmtNum(dash.clubs.suspended)} />
            <Kpi label={lang === "ar" ? "تجربة تنتهي ≤7ج" : "Essais ≤7 j"} value={fmtNum(dash.clubs.trials_expiring_7d)} />
            <Kpi
              label={lang === "ar" ? "متصلون الآن" : "En ligne"}
              value={fmtNum(dash.users.online)}
              hint={`${dash.online_window_minutes} min`}
            />
            <Kpi label={lang === "ar" ? "أولياء متصلون" : "Parents en ligne"} value={fmtNum(dash.users.online_by_role.parent || 0)} />
            <Kpi label={lang === "ar" ? "حسابات" : "Comptes"} value={fmtNum(dash.users.total)} hint={`${fmtNum(dash.users.active)} ${lang === "ar" ? "نشط" : "actifs"}`} />
            <Kpi label={lang === "ar" ? "لاعبون" : "Athlètes"} value={fmtNum(dash.activity.athletes_total)} />
            <Kpi label={lang === "ar" ? "تسجيلات الشهر" : "Inscriptions mois"} value={fmtNum(dash.activity.registrations_month)} />
            <Kpi label={lang === "ar" ? "مدفوعات الشهر" : "Paiements mois"} value={fmtNum(dash.activity.payments_month)} hint={fmtMoney(dash.activity.payments_amount_month)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>{lang === "ar" ? "الحسابات حسب الدور" : "Comptes par rôle"}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang === "ar" ? "الدور" : "Rôle"}</th>
                    <th>{lang === "ar" ? "العدد" : "Total"}</th>
                    <th>{lang === "ar" ? "متصل" : "En ligne"}</th>
                  </tr>
                </thead>
                <tbody>
                  {roleBreakdown.map((r) => (
                    <tr key={r.role}>
                      <td>{roleLabel(r.role, lang)}</td>
                      <td>{fmtNum(r.n)}</td>
                      <td>{fmtNum(r.online)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>{lang === "ar" ? "خطط الاشتراك" : "Plans"}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("platformPlan")}</th>
                    <th>{lang === "ar" ? "أندية" : "Clubs"}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dash.clubs.by_plan).map(([p, n]) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td>{fmtNum(n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>{lang === "ar" ? "المتصلون الآن" : "Connectés maintenant"}</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === "ar" ? "الاسم" : "Nom"}</th>
                  <th>{lang === "ar" ? "الدور" : "Rôle"}</th>
                  <th>{lang === "ar" ? "النادي" : "Club"}</th>
                  <th>{lang === "ar" ? "آخر ظهور" : "Dernière activité"}</th>
                </tr>
              </thead>
              <tbody>
                {dash.online_users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{roleLabel(u.role, lang)}</td>
                    <td>{u.club_name || u.club_slug || (u.role === "superadmin" ? "—" : "—")}</td>
                    <td>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dash.online_users.length && (
              <p className="muted">{lang === "ar" ? "لا أحد متصل حالياً" : "Personne en ligne pour le moment"}</p>
            )}
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>{lang === "ar" ? "أحدث الأندية" : "Clubs récents"}</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>{t("platformSlug")}</th>
                  <th>{t("brand")}</th>
                  <th>{t("platformPlan")}</th>
                  <th>{t("status")}</th>
                  <th>{t("platformAthletes")}</th>
                  <th>{lang === "ar" ? "حسابات" : "Comptes"}</th>
                  <th>{lang === "ar" ? "متصلون" : "En ligne"}</th>
                </tr>
              </thead>
              <tbody>
                {dash.recent_clubs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.slug}</code>
                    </td>
                    <td>{lang === "ar" && r.name_ar ? r.name_ar : r.name}</td>
                    <td>{r.plan || "—"}</td>
                    <td>{r.status || "—"}</td>
                    <td>{fmtNum(r.athletes_count)}</td>
                    <td>{fmtNum(r.users_count)}</td>
                    <td>{fmtNum(r.online_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "clubs" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("platformSlug")}</th>
                <th>{t("brand")}</th>
                <th>{t("platformPlan")}</th>
                <th>{t("status")}</th>
                <th>{t("platformTrial")}</th>
                <th>{t("platformAthletes")}</th>
                <th>{lang === "ar" ? "حسابات" : "Comptes"}</th>
                <th>{lang === "ar" ? "متصلون" : "En ligne"}</th>
                <th>{lang === "ar" ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((r) => {
                const suspended = (r.status || "").toLowerCase() === "suspended";
                return (
                  <tr key={r.id}>
                    <td>
                      <code>{r.slug}</code>
                      {r.is_platform ? " · demo" : ""}
                    </td>
                    <td>{lang === "ar" && r.name_ar ? r.name_ar : r.name}</td>
                    <td>
                      <select
                        value={r.plan || "club"}
                        disabled={busyId === r.id}
                        onChange={(e) => void setPlan(r, e.target.value)}
                      >
                        <option value="discovery">discovery</option>
                        <option value="club">club</option>
                        <option value="academy">academy</option>
                      </select>
                    </td>
                    <td>{r.status || "—"}</td>
                    <td>{r.trial_ends_on || "—"}</td>
                    <td>{fmtNum(r.athletes_count)}</td>
                    <td>{fmtNum(r.users_count)}</td>
                    <td>{fmtNum(r.online_count)}</td>
                    <td>
                      <button
                        type="button"
                        className={suspended ? "secondary" : "danger"}
                        disabled={busyId === r.id}
                        onClick={() => void toggleStatus(r)}
                      >
                        {busyId === r.id
                          ? "…"
                          : suspended
                            ? t("platformReactivate")
                            : t("platformSuspend")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!clubs.length && !loading && <p className="muted">{t("empty")}</p>}
        </div>
      )}

      {tab === "users" && (
        <>
          <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="muted">{lang === "ar" ? "الدور" : "Rôle"}</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">{lang === "ar" ? "الكل" : "Tous"}</option>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
              <span>{lang === "ar" ? "المتصلون فقط" : "En ligne seulement"}</span>
            </label>
            <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 180 }}>
              <span className="muted">{lang === "ar" ? "بحث" : "Recherche"}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nom / email / tel" />
            </label>
            <button type="button" onClick={() => void loadUsers()}>
              {lang === "ar" ? "تطبيق" : "Filtrer"}
            </button>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === "ar" ? "الاسم" : "Nom"}</th>
                  <th>{lang === "ar" ? "الدور" : "Rôle"}</th>
                  <th>{lang === "ar" ? "النادي" : "Club"}</th>
                  <th>{lang === "ar" ? "حالة" : "Statut"}</th>
                  <th>{lang === "ar" ? "حضور" : "Présence"}</th>
                  <th>{lang === "ar" ? "آخر ظهور" : "Dernière activité"}</th>
                  <th>{lang === "ar" ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>{u.full_name}</div>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {u.email || u.phone || "—"}
                      </div>
                    </td>
                    <td>{roleLabel(u.role, lang)}</td>
                    <td>{u.club_name || u.club_slug || "—"}</td>
                    <td>{u.is_active ? (lang === "ar" ? "نشط" : "Actif") : lang === "ar" ? "معطل" : "Inactif"}</td>
                    <td>
                      <span style={{ color: u.online ? "#15803d" : undefined, fontWeight: u.online ? 700 : 400 }}>
                        {u.online ? (lang === "ar" ? "متصل" : "En ligne") : lang === "ar" ? "غير متصل" : "Hors ligne"}
                      </span>
                    </td>
                    <td>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ") : "—"}</td>
                    <td>
                      {u.role === "superadmin" ? (
                        "—"
                      ) : (
                        <button
                          type="button"
                          className={u.is_active ? "danger" : "secondary"}
                          disabled={busyId === u.id}
                          onClick={() => void toggleUserActive(u)}
                        >
                          {busyId === u.id
                            ? "…"
                            : u.is_active
                              ? lang === "ar"
                                ? "تعطيل"
                                : "Désactiver"
                              : lang === "ar"
                                ? "تفعيل"
                                : "Activer"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && !loading && <p className="muted">{t("empty")}</p>}
          </div>
        </>
      )}
    </div>
  );
}
