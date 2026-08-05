import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, apiGetFast, formatDateFr, isDzMobile, mediaUrl } from "../api/client";
import { CallButton, PhoneCell } from "../components/CallButton";
import { PhotoCapture } from "../components/PhotoCapture";
import { SortHeader, type SortDir } from "../components/SortHeader";
import { confirmDialog } from "../components/ConfirmDialog";
import { toast } from "../components/Toast";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

type Category = {
  id: number;
  code: string;
  birth_year_min: number;
  birth_year_max: number;
};

type Athlete = {
  id: number;
  legacy_number?: number;
  full_name: string;
  birth_date?: string;
  birth_place?: string;
  status: string;
  notes?: string;
  photo_path?: string;
  parent_phone?: string;
  blood_type?: string;
  category_id?: number;
  category_code?: string;
  last_payment_on?: string | null;
  last_payment_amount?: number | null;
};

type PaymentRow = {
  id: number;
  athlete_id: number;
  amount: number;
  paid_on?: string;
  method: string;
  notes?: string;
  seq_no?: number;
  reference?: string;
};

const PAGE = 40;
const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function AthletesPage() {
  const { t, lang } = useI18n();
  const { role } = useAuth();
  const canDelete = role === "admin" || role === "direction";
  const [rows, setRows] = useState<Athlete[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
    blood_type: "",
  });
  // Nouveaux joueurs en premier (décroissant) — obligatoire en arabe
  const [sortKey, setSortKey] = useState("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("Active");
  const [editNote, setEditNote] = useState("");
  const [editBlood, setEditBlood] = useState("");
  const [editForm, setEditForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editInstallments, setEditInstallments] = useState<
    { id: number; label: string; label_ar?: string; amount: number; amount_paid: number; status: string }[]
  >([]);
  const [editPayments, setEditPayments] = useState<PaymentRow[]>([]);
  const [editPay, setEditPay] = useState<PaymentRow | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "icons">("table");
  const [payType, setPayType] = useState("monthly");
  const [payAmount, setPayAmount] = useState("800");
  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [feeDefaults, setFeeDefaults] = useState({ monthly: 800, insurance: 1500 });
  const savingRef = useRef(false);

  function onSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  // AR : toujours afficher les nouveaux joueurs en ordre décroissant (الأحدث أولاً)
  useEffect(() => {
    if (lang === "ar") {
      setSortKey("recent");
      setSortDir("desc");
    }
  }, [lang]);

  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    apiGetFast<Category[]>("/api/v1/categories", {
      ttlMs: 120_000,
      onUpdate: setCats,
    })
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  const load = useCallback(
    async (opts?: { append?: boolean; offset?: number }) => {
      const append = !!opts?.append;
      const offset = opts?.offset ?? 0;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          limit: String(PAGE),
          skip: String(offset),
        });
        if (qDebounced) params.set("q", qDebounced);
        if (statusFilter) params.set("status", statusFilter);
        if (categoryId) params.set("category_id", String(categoryId));
        params.set("sort", sortKey);
        params.set("order", sortDir);
        const path = `/api/v1/athletes?${params}`;
        const data = append
          ? await api<Athlete[]>(path)
          : await apiGetFast<Athlete[]>(path, {
              ttlMs: 40_000,
              onUpdate: (fresh) => {
                setRows(fresh);
                setHasMore(fresh.length >= PAGE);
                setLoading(false);
              },
            });
        setRows((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length >= PAGE);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
        if (!append) setRows([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [qDebounced, statusFilter, categoryId, sortKey, sortDir],
  );

  useEffect(() => {
    load({ offset: 0 });
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (savingRef.current) return; // anti double-clic
    if (!form.birth_date) {
      setError("Date de naissance obligatoire (5–17 ans)");
      return;
    }
    if (!isDzMobile(form.parent_phone)) {
      setError("Téléphone DZ invalide (05/06/07…)");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await api("/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          birth_date: form.birth_date,
          birth_place: form.birth_place || null,
          photo_path: form.photo_path || null,
          blood_type: form.blood_type || null,
          parent_phone: form.parent_phone,
          parent_name: form.parent_name || null,
        }),
      });
      toast(`Joueur ajouté : ${form.full_name}`, "success");
      setForm({
        full_name: "",
        birth_date: "",
        birth_place: "",
        parent_phone: "",
        parent_name: "",
        photo_path: "",
        blood_type: "",
      });
      load({ offset: 0 });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setError(m);
      toast(m, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function reloadEditFinance(athleteId: number) {
    api<
      { id: number; label: string; label_ar?: string; amount: number; amount_paid: number; status: string }[]
    >(`/api/v1/installments?athlete_id=${athleteId}&limit=50`)
      .then(setEditInstallments)
      .catch(() => setEditInstallments([]));
    api<PaymentRow[]>(`/api/v1/payments/recent?athlete_id=${athleteId}&limit=50`)
      .then(setEditPayments)
      .catch(() => setEditPayments([]));
  }

  function openEdit(r: Athlete) {
    setEditId(r.id);
    setEditPay(null);
    setEditStatus(r.status);
    setEditNote(r.notes || "");
    setEditBlood(r.blood_type || "");
    setEditForm({
      full_name: r.full_name || "",
      birth_date: r.birth_date || "",
      birth_place: r.birth_place || "",
      parent_phone: r.parent_phone || "",
      parent_name: "",
      photo_path: r.photo_path || "",
    });
    setPayType("monthly");
    setEditPayments([]);
    apiGetFast<{ monthly_subscription_dzd: number; annual_insurance_dzd: number }>("/api/v1/finance/settings", {
      ttlMs: 120_000,
    })
      .then((s) => {
        setFeeDefaults({ monthly: Number(s.monthly_subscription_dzd), insurance: Number(s.annual_insurance_dzd) });
        setPayAmount(String(s.monthly_subscription_dzd));
      })
      .catch(() => undefined);
    reloadEditFinance(r.id);
  }

  async function savePaymentEdit() {
    if (!editPay || !editId) return;
    try {
      await api(`/api/v1/payments/${editPay.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: Number(editPay.amount),
          method: editPay.method,
          paid_on: editPay.paid_on,
          notes: editPay.notes || null,
        }),
      });
      toast("Paiement modifié", "success");
      setEditPay(null);
      reloadEditFinance(editId);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function deletePayment(row: PaymentRow) {
    const ok = await confirmDialog({
      title: "Supprimer le paiement",
      message: `Supprimer le paiement du ${formatDateFr(row.paid_on)} (${Number(row.amount).toLocaleString()} DZD) ?`,
      confirmLabel: "Supprimer",
    });
    if (!ok || !editId) return;
    try {
      await api(`/api/v1/payments/${row.id}`, { method: "DELETE" });
      toast("Paiement supprimé", "success");
      if (editPay?.id === row.id) setEditPay(null);
      reloadEditFinance(editId);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function onQuickPayAthlete() {
    if (!editId) return;
    try {
      const body: Record<string, unknown> = {
        payment_type: payType,
        athlete_id: editId,
        amount: Number(payAmount),
        paid_on: new Date().toISOString().slice(0, 10),
        method: "cash",
      };
      if (payType === "monthly") {
        body.month = Number(payMonth);
        body.year = new Date().getFullYear();
      }
      if (payType === "equipment") body.equipment_label = "équipement";
      const res = await api<{ label: string; amount: number; receipt_number: string }>("/api/v1/payments/quick", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(`✓ ${res.label} — ${Number(res.amount).toLocaleString()} DZD`, "success");
      reloadEditFinance(editId);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function onEditSave() {
    if (!editId || editSaving) return;
    setMsg("");
    setError("");
    if (editForm.parent_phone && !isDzMobile(editForm.parent_phone)) {
      setError("Téléphone DZ invalide (05/06/07…)");
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        full_name: editForm.full_name,
        birth_date: editForm.birth_date || null,
        birth_place: editForm.birth_place || null,
        status: editStatus,
        notes: editNote,
        blood_type: editBlood || null,
        photo_path: editForm.photo_path || null,
        confirm_status: true,
      };
      if (editForm.parent_phone) body.parent_phone = editForm.parent_phone;
      if (editForm.parent_name) body.parent_name = editForm.parent_name;
      await api(`/api/v1/athletes/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditId(null);
      toast("Joueur mis à jour", "success");
      load({ offset: 0 });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setError(m);
      toast(m, "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function onArchiveAthlete() {
    if (!editId) return;
    const ok = await confirmDialog({
      title: "Archiver le joueur",
      message: "Archiver ce joueur (statut Abandonne) ?\nIl reste récupérable via le filtre statut ou Historique.",
      confirmLabel: "Archiver",
    });
    if (!ok) return;
    setEditStatus("Abandonne");
    if (!editNote.trim()) setEditNote("Archivé depuis la fiche joueur");
    setEditSaving(true);
    try {
      await api(`/api/v1/athletes/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Abandonne",
          notes: editNote.trim() || "Archivé depuis la fiche joueur",
          confirm_status: true,
        }),
      });
      setEditId(null);
      toast("Joueur archivé — récupérable", "success");
      load({ offset: 0 });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function onDeleteAthlete() {
    if (!editId || !canDelete) return;
    const ok = await confirmDialog({
      title: "Supprimer le joueur",
      message:
        "Supprimer ce joueur ?\nLa suppression est réversible : le joueur est archivé (Abandonne) et reste récupérable dans Historique.",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    setEditSaving(true);
    try {
      await api(`/api/v1/athletes/${editId}`, { method: "DELETE" });
      setEditId(null);
      toast("Joueur supprimé (récupérable dans Historique)", "success");
      load({ offset: 0 });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <form className="card" onSubmit={onCreate}>
        <h3 style={{ marginTop: 0 }}>{t("addPlayer")}</h3>
        <div className="form-split">
          <PhotoCapture value={form.photo_path} onUploaded={(p) => setForm({ ...form, photo_path: p })} />
          <div>
            <div className="field">
              <label>Nom / الاسم</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Date de naissance (jj/mm/aaaa) *</label>
              <input
                type="date"
                required
                lang="fr-DZ"
                className="ltr"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Lieu / مكان الميلاد</label>
              <input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
            </div>
            <div className="field">
              <label>{t("bloodType")}</label>
              <select value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b || "none"} value={b}>
                    {b || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("parentPhone")} *</label>
              <div className="phone-row">
                <input
                  required
                  placeholder="05XXXXXXXX"
                  inputMode="tel"
                  className="ltr"
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                />
                <CallButton phone={form.parent_phone} />
              </div>
            </div>
            <div className="field">
              <label>Nom parent / اسم الولي</label>
              <input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
        {error && <p style={{ color: "var(--danger, #dc2626)" }}>{error}</p>}
      </form>

      <div className="card">
        <div className="cat-chips" style={{ marginBottom: 12 }}>
          <strong>{t("filterCategory")}</strong>
          <div
            className="chips"
            style={{ overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}
          >
            <button
              type="button"
              className={`chip ${categoryId === null ? "active" : ""}`}
              onClick={() => setCategoryId(null)}
            >
              {t("allCategories")}
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${categoryId === c.id ? "active" : ""}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder={t("searchName")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #d7deee" }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Actifs</option>
            <option value="Active">Active</option>
            <option value="Abandonne">Archives (Abandonne)</option>
            <option value="Inactif">Inactif</option>
            <option value="all">Tous</option>
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`chip ${viewMode === "table" ? "active" : ""}`}
              style={{ flexDirection: "row", whiteSpace: "nowrap" }}
              onClick={() => setViewMode("table")}
            >
              Tableau
            </button>
            <button
              type="button"
              className={`chip ${viewMode === "icons" ? "active" : ""}`}
              style={{ flexDirection: "row", whiteSpace: "nowrap" }}
              onClick={() => setViewMode("icons")}
            >
              Icônes
            </button>
          </div>
          <button type="button" className="secondary" onClick={() => load({ offset: 0 })}>
            {t("retry")}
          </button>
        </div>
        {loading && <p className="muted">{t("loading")}</p>}
        {!loading && !rows.length && <p className="muted">{error || t("empty")}</p>}
        {viewMode === "table" ? (
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <SortHeader
                label={lang === "ar" ? "جديد ↕" : "Récent"}
                sortKey="recent"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader label="#" sortKey="number" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Nom / الاسم" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th>Cat.</th>
              <th>{t("bloodType")}</th>
              <th>Parent ☎</th>
              <SortHeader label="Naissance" sortKey="birth" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label={t("status")} sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.photo_path ? (
                    <img
                      className="avatar"
                      src={mediaUrl(r.photo_path)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        const ph = document.createElement("span");
                        ph.className = "avatar placeholder";
                        ph.textContent = "?";
                        el.parentElement?.appendChild(ph);
                      }}
                    />
                  ) : (
                    <span className="avatar placeholder">?</span>
                  )}
                </td>
                <td className="muted" style={{ fontSize: "0.85em" }}>
                  {r.id}
                </td>
                <td>{r.legacy_number ?? "—"}</td>
                <td>{r.full_name}</td>
                <td>{r.category_code || "—"}</td>
                <td>{r.blood_type || "—"}</td>
                <td>
                  <PhoneCell phone={r.parent_phone} />
                </td>
                <td>{formatDateFr(r.birth_date)}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="secondary" onClick={() => openEdit(r)}>
                      {t("edit")}
                    </button>
                    {r.status !== "Abandonne" && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirmDialog({
                              title: "Archiver le joueur",
                              message: `Archiver « ${r.full_name} » (statut Abandonne) ?\nRécupérable via filtre statut ou Historique.`,
                              confirmLabel: "Archiver",
                            });
                            if (!ok) return;
                            try {
                              await api(`/api/v1/athletes/${r.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  status: "Abandonne",
                                  notes: r.notes || "Archivé depuis la liste joueurs",
                                  confirm_status: true,
                                }),
                              });
                              if (editId === r.id) setEditId(null);
                              toast("Joueur archivé — récupérable", "success");
                              load({ offset: 0 });
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Erreur", "error");
                            }
                          })();
                        }}
                      >
                        Archiver
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirmDialog({
                              title: "Supprimer le joueur",
                              message: `Supprimer « ${r.full_name} » ?\nRéversible : archivage Abandonne, récupérable dans Historique.`,
                              confirmLabel: "Supprimer",
                            });
                            if (!ok) return;
                            try {
                              await api(`/api/v1/athletes/${r.id}`, { method: "DELETE" });
                              if (editId === r.id) setEditId(null);
                              toast("Joueur supprimé (récupérable)", "success");
                              load({ offset: 0 });
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Erreur", "error");
                            }
                          })();
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        ) : (
          <div className="roster-grid">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                className="roster-card"
                style={{ cursor: "pointer", width: "100%" }}
                onClick={() => openEdit(r)}
              >
                {r.photo_path ? (
                  <img
                    src={mediaUrl(r.photo_path)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="roster-avatar">{r.full_name.slice(0, 1) || "?"}</span>
                )}
                <strong style={{ fontSize: "0.95rem", lineHeight: 1.2 }}>{r.full_name}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {r.category_code || "—"}
                </span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Dernier paiement :{" "}
                  {r.last_payment_on
                    ? `${formatDateFr(r.last_payment_on)}${
                        r.last_payment_amount != null
                          ? ` · ${Number(r.last_payment_amount).toLocaleString()} DZD`
                          : ""
                      }`
                    : "—"}
                </span>
                <span className="badge">{r.status}</span>
              </button>
            ))}
          </div>
        )}
        {hasMore && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
              type="button"
              className="secondary"
              disabled={loadingMore}
              onClick={() => load({ append: true, offset: rows.length })}
            >
              {loadingMore ? t("loading") : t("loadMore")}
            </button>
          </div>
        )}
      </div>

      {editId && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {t("edit")} #{editId}
          </h3>
          <div className="form-split">
            <PhotoCapture
              value={editForm.photo_path}
              athleteId={editId ?? undefined}
              onUploaded={(p) => setEditForm({ ...editForm, photo_path: p })}
            />
            <div>
          <div className="field">
            <label>Nom / الاسم</label>
            <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          </div>
          <div className="field">
            <label>Date de naissance (jj/mm/aaaa)</label>
            <input
              type="date"
              lang="fr-DZ"
              className="ltr"
              value={editForm.birth_date}
              onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Lieu / مكان الميلاد</label>
            <input value={editForm.birth_place} onChange={(e) => setEditForm({ ...editForm, birth_place: e.target.value })} />
          </div>
          <div className="field">
            <label>{t("parentPhone")}</label>
            <div className="phone-row">
              <input
                placeholder="05XXXXXXXX"
                inputMode="tel"
                className="ltr"
                value={editForm.parent_phone}
                onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })}
              />
              <CallButton phone={editForm.parent_phone} />
            </div>
          </div>
          <div className="field">
            <label>Nom parent / اسم الولي</label>
            <input value={editForm.parent_name} onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })} />
          </div>
            </div>
          </div>
          <div className="field">
            <label>{t("status")}</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Abandonne">Abandonne</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>
          <div className="field">
            <label>{t("bloodType")}</label>
            <select value={editBlood} onChange={(e) => setEditBlood(e.target.value)}>
              {BLOOD_TYPES.map((b) => (
                <option key={b || "none"} value={b}>
                  {b || "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} />
          </div>

          <div style={{ borderTop: "1px solid #e5eaf3", paddingTop: 12, marginTop: 8 }}>
            <h4 style={{ margin: "0 0 8px" }}>Paiements / الدفعات</h4>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              <div className="field">
                <label>Type</label>
                <select
                  value={payType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPayType(v);
                    setPayAmount(
                      String(v === "insurance" ? feeDefaults.insurance : v === "monthly" ? feeDefaults.monthly : payAmount),
                    );
                  }}
                >
                  <option value="monthly">Abonnement mensuel</option>
                  <option value="insurance">Assurance annuelle</option>
                  <option value="inscription">Inscription</option>
                  <option value="equipment">Équipement</option>
                </select>
              </div>
              {payType === "monthly" && (
                <div className="field">
                  <label>Mois</label>
                  <select value={payMonth} onChange={(e) => setPayMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Montant DZD</label>
                <input className="ltr" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
            </div>
            <button type="button" className="secondary" onClick={onQuickPayAthlete}>
              Enregistrer paiement
            </button>
            {editInstallments.length > 0 && (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Échéance</th>
                    <th>Payé</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {editInstallments.slice(0, 12).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.label}
                        {i.label_ar ? ` · ${i.label_ar}` : ""}
                      </td>
                      <td>
                        {Number(i.amount_paid).toLocaleString()} / {Number(i.amount).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge">{i.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4 style={{ margin: "16px 0 8px" }}>Historique paiements</h4>
            {editPay && (
              <div style={{ border: "1px solid #d7deee", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  Modifier paiement #{editPay.seq_no ?? editPay.id}
                </p>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  <div className="field">
                    <label>Montant DZD</label>
                    <input
                      className="ltr"
                      value={String(editPay.amount)}
                      onChange={(e) => setEditPay({ ...editPay, amount: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="field">
                    <label>Mode</label>
                    <input value={editPay.method} onChange={(e) => setEditPay({ ...editPay, method: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Date</label>
                    <input
                      type="date"
                      className="ltr"
                      value={editPay.paid_on || ""}
                      onChange={(e) => setEditPay({ ...editPay, paid_on: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <input value={editPay.notes || ""} onChange={(e) => setEditPay({ ...editPay, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => void savePaymentEdit()}>
                    Enregistrer
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditPay(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {editPayments.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {editPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateFr(p.paid_on)}</td>
                      <td>{Number(p.amount).toLocaleString()} DZD</td>
                      <td>{p.method}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" className="secondary" onClick={() => setEditPay({ ...p })}>
                            Modifier
                          </button>
                          {canDelete && (
                            <button type="button" className="danger" onClick={() => void deletePayment(p)}>
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Aucun paiement enregistré</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={editSaving} onClick={onEditSave}>
              {editSaving ? t("saving") : t("save")}
            </button>
            <button type="button" className="secondary" onClick={() => setEditId(null)}>
              {t("cancel")}
            </button>
            {editStatus !== "Abandonne" && (
              <button type="button" className="secondary" disabled={editSaving} onClick={() => void onArchiveAthlete()}>
                Archiver
              </button>
            )}
            {canDelete && (
              <button type="button" className="danger" disabled={editSaving} onClick={() => void onDeleteAthlete()}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
