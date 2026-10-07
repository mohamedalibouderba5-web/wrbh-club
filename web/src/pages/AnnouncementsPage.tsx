import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { caps } from "../roles/access";

type Ann = { id: number; title: string; title_ar?: string; body: string; audience: string; is_pinned: boolean };

export function AnnouncementsPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const canPublish = caps(role).canPublishAnnouncements;
  const [rows, setRows] = useState<Ann[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", title_ar: "", body: "", audience: "all" });

  async function load() {
    setLoading(true);
    try {
      const data = await api<Ann[] | { items?: Ann[] }>("/api/v1/announcements");
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: Ann[] })?.items)
          ? ((data as { items: Ann[] }).items)
          : [];
      setRows(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canPublish) return;
    try {
      await api("/api/v1/announcements", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", title_ar: "", body: "", audience: "all" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: canPublish ? "1fr 1fr" : "1fr", gap: "1rem" }}>
      {canPublish && (
        <form className="card" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>{t("newAnnouncement")}</h3>
          <div className="field">
            <label>Titre FR</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Titre AR</label>
            <input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} dir="rtl" />
          </div>
          <div className="field">
            <label>Message</label>
            <textarea required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="field">
            <label>Audience</label>
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">{t("audienceAll")}</option>
              <option value="parents">{t("parents")}</option>
              <option value="coaches">Coaches</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button type="submit">{t("publish")}</button>
          {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        </form>
      )}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fil</h3>
        {!canPublish && (
          <p className="muted" style={{ marginTop: 0 }}>
            Lecture seule — la publication est réservée à l’administration / staff.
          </p>
        )}
        {loading && !rows.length && <p className="muted">{t("loading")}</p>}
        {rows.map((a) => (
          <div key={a.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #edf0f7" }}>
            <strong>{a.title}</strong>
            {a.title_ar && (
              <div className="ar" style={{ color: "var(--muted)" }}>
                {a.title_ar}
              </div>
            )}
            <p style={{ margin: "0.35rem 0" }}>{a.body}</p>
            <span className="badge">{a.audience}</span>
          </div>
        ))}
        {!loading && !rows.length && !error && <p className="muted">Aucune annonce</p>}
        {error && (
          <p style={{ color: "#dc2626" }}>
            {error}{" "}
            <button type="button" className="secondary btn-fit" onClick={() => void load()}>
              {t("retry")}
            </button>
          </p>
        )}
        {!loading && rows.length > 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            {rows.length} annonce{rows.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
