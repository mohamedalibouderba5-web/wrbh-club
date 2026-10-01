import { useCallback, useEffect, useState } from "react";
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
};

export function SuperAdminPage() {
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<ClubRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (role !== "superadmin") return;
    setLoading(true);
    setError("");
    api<ClubRow[]>("/api/v1/admin/clubs")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : t("toastError")))
      .finally(() => setLoading(false));
  }, [role, t]);

  useEffect(() => {
    load();
  }, [load]);

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
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      setMsg(
        next === "suspended"
          ? lang === "ar"
            ? "تم تعليق النادي"
            : "Club suspendu"
          : lang === "ar"
            ? "تم تفعيل النادي"
            : "Club réactivé",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toastError"));
    } finally {
      setBusyId(null);
    }
  }

  if (role !== "superadmin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="grid" style={{ gap: "1rem" }} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="card">
        <h2 style={{ margin: 0 }}>{t("platformAdmin")}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {lang === "ar"
            ? "تعليق / تفعيل الأندية — القراءة والكتابة محدودة للمنصة"
            : "Suspendre / réactiver un club — écriture limitée au statut"}
        </p>
      </div>
      {loading && <p className="muted">{t("loading")}</p>}
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      {!loading && !error && (
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
                <th>{lang === "ar" ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const suspended = (r.status || "").toLowerCase() === "suspended";
                return (
                  <tr key={r.id}>
                    <td>
                      <code>{r.slug}</code>
                      {r.is_platform ? " · demo" : ""}
                    </td>
                    <td>{lang === "ar" && r.name_ar ? r.name_ar : r.name}</td>
                    <td>{r.plan || "—"}</td>
                    <td>{r.status || "—"}</td>
                    <td>{r.trial_ends_on || "—"}</td>
                    <td>{r.athletes_count}</td>
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
                            ? lang === "ar"
                              ? "تفعيل"
                              : "Réactiver"
                            : lang === "ar"
                              ? "تعليق"
                              : "Suspendre"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p className="muted">{t("empty")}</p>}
        </div>
      )}
    </div>
  );
}
