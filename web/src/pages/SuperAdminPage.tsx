import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== "superadmin") return;
    setLoading(true);
    api<ClubRow[]>("/api/v1/admin/clubs")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : t("toastError")))
      .finally(() => setLoading(false));
  }, [role, t]);

  if (role !== "superadmin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="grid" style={{ gap: "1rem" }} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="card">
        <h2 style={{ margin: 0 }}>{t("platformAdmin")}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t("platformAdminHint")}
        </p>
      </div>
      {loading && <p className="muted">{t("loading")}</p>}
      {error && <p className="error">{error}</p>}
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.slug}</code>
                    {r.is_platform ? " · demo" : ""}
                  </td>
                  <td>
                    {lang === "ar" && r.name_ar ? r.name_ar : r.name}
                  </td>
                  <td>{r.plan || "—"}</td>
                  <td>{r.status || "—"}</td>
                  <td>{r.trial_ends_on || "—"}</td>
                  <td>{r.athletes_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted">{t("empty")}</p>}
        </div>
      )}
    </div>
  );
}
