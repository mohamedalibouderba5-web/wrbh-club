import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiGetFast, formatDateFr, isDzMobile, loadAllSettled, mediaUrl, uploadPhoto } from "../api/client";
import { CallButton, PhoneCell } from "../components/CallButton";
import { PhotoCapture } from "../components/PhotoCapture";
import { SortHeader, type SortDir } from "../components/SortHeader";
import { confirmDialog } from "../components/ConfirmDialog";
import { toast } from "../components/Toast";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import {
  enqueueRegistration,
  isNetworkError,
  listPendingRegistrations,
  type PendingRegistration,
  type RegPayload,
} from "../offline/registrationQueue";
import { syncPendingRegistrations } from "../offline/sync";

type Season = { id: number; name: string; is_current: boolean };
type Category = {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  birth_year_min: number;
  birth_year_max: number;
  season_id?: number;
};
type Reg = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  athlete_photo?: string;
  birth_date?: string;
  birth_place?: string;
  blood_type?: string;
  category_code?: string;
  category_id?: number;
  parent_phone?: string;
  parent_temp_password?: string;
  parent_created?: boolean;
  season_id: number;
  status: string;
  source: string;
  registered_on?: string;
  subscription_fee?: number | string;
  notes?: string;
  seq_no?: number;
  reference?: string;
};

const PAGE = 40;
const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function RegistrationsPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const canHardDelete = role === "admin" || role === "direction";
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [listCategoryId, setListCategoryId] = useState<number | null>(null);
  const [listStatus, setListStatus] = useState<"active" | "archived">("active");
  const [editId, setEditId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [sortKey, setSortKey] = useState("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const savingRef = useRef(false);

  function onSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    birth_place: "",
    season_id: 0,
    category_id: 0,
    subscription_fee: "4000",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
    blood_type: "",
  });

  const seasonCats = useMemo(() => {
    if (!form.season_id) return cats;
    return cats.filter((c) => !c.season_id || c.season_id === form.season_id);
  }, [cats, form.season_id]);

  const selectedCat = seasonCats.find((c) => c.id === form.category_id);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await listPendingRegistrations());
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    const onQueue = () => void refreshPending();
    const onSynced = () => {
      void refreshPending();
      window.dispatchEvent(new CustomEvent("wrbh:regs-refresh"));
    };
    window.addEventListener("wrbh:offline-queue", onQueue);
    window.addEventListener("wrbh:offline-synced", onSynced);
    return () => {
      window.removeEventListener("wrbh:offline-queue", onQueue);
      window.removeEventListener("wrbh:offline-synced", onSynced);
    };
  }, [refreshPending]);

  const loadRegs = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setListLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: String(PAGE) });
        if (listCategoryId) params.set("category_id", String(listCategoryId));
        if (form.season_id) params.set("season_id", String(form.season_id));
        if (listStatus === "archived") params.set("status", "archived");
        params.set("sort", sortKey);
        params.set("order", sortDir);
        const path = `/api/v1/registrations?${params}`;
        const r = await apiGetFast<Reg[]>(path, {
          ttlMs: 40_000,
          onUpdate: (fresh) => {
            setRegs(fresh);
            setListLoading(false);
            setLoading(false);
          },
        });
        setRegs(r);
      } catch (err) {
        if (!isNetworkError(err)) {
          setError(err instanceof Error ? err.message : "Erreur");
        }
      } finally {
        setListLoading(false);
        setLoading(false);
      }
    },
    [listCategoryId, listStatus, form.season_id, sortKey, sortDir],
  );

  useEffect(() => {
    const onRefresh = () => void loadRegs({ quiet: true });
    window.addEventListener("wrbh:regs-refresh", onRefresh);
    return () => window.removeEventListener("wrbh:regs-refresh", onRefresh);
  }, [loadRegs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, errors } = await loadAllSettled<[Season[], Category[], { inscription_fee_dzd: number }]>([
        () => apiGetFast<Season[]>("/api/v1/seasons", { ttlMs: 120_000 }),
        () => apiGetFast<Category[]>("/api/v1/categories", { ttlMs: 120_000 }),
        () => apiGetFast<{ inscription_fee_dzd: number }>("/api/v1/finance/settings", { ttlMs: 120_000 }).catch(() => ({
          inscription_fee_dzd: 4000,
        })),
      ]);
      if (cancelled) return;
      const [s, c, fees] = data;
      if (s) {
        setSeasons(s);
        const current = s.find((x) => x.is_current) || s[0];
        if (current) setForm((f) => ({ ...f, season_id: f.season_id || current.id }));
      }
      if (c) setCats(c);
      if (fees?.inscription_fee_dzd != null) {
        setForm((f) => ({ ...f, subscription_fee: String(fees.inscription_fee_dzd) }));
      }
      if (errors.length && !s && !c) setError(errors.join(" · "));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.season_id && !seasons.length) return;
    loadRegs();
  }, [loadRegs, form.season_id, seasons.length]);

  function clearFormKeepSeason() {
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditId(null);
    setForm((f) => ({
      ...f,
      full_name: "",
      birth_date: "",
      birth_place: "",
      parent_phone: "",
      parent_name: "",
      photo_path: "",
      blood_type: "",
      category_id: 0,
    }));
  }

  function openEdit(r: Reg) {
    setEditId(r.id);
    setError("");
    setMsg("");
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm((f) => ({
      ...f,
      full_name: r.athlete_name || "",
      birth_date: r.birth_date || "",
      birth_place: r.birth_place || "",
      season_id: r.season_id || f.season_id,
      category_id: r.category_id || 0,
      subscription_fee: r.subscription_fee != null ? String(r.subscription_fee) : f.subscription_fee,
      parent_phone: r.parent_phone || "",
      parent_name: "",
      photo_path: "",
      blood_type: r.blood_type || "",
    }));
    // Chemin photo brut + champs complets depuis la fiche athlète
    void api<{
      full_name: string;
      birth_date?: string;
      birth_place?: string;
      blood_type?: string;
      photo_path?: string;
      parent_phone?: string;
    }>(`/api/v1/athletes/${r.athlete_id}`)
      .then((a) => {
        setForm((f) => ({
          ...f,
          full_name: a.full_name || f.full_name,
          birth_date: a.birth_date || f.birth_date,
          birth_place: a.birth_place || f.birth_place,
          blood_type: a.blood_type || f.blood_type,
          photo_path: a.photo_path || "",
          parent_phone: a.parent_phone || f.parent_phone,
        }));
      })
      .catch(() => undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload(): RegPayload {
    return {
      season_id: form.season_id,
      category_id: form.category_id || null,
      subscription_fee: Number(form.subscription_fee),
      source: "web",
      parent_phone: form.parent_phone,
      parent_name: form.parent_name || null,
      photo_path: form.photo_path || null,
      athlete: {
        full_name: form.full_name,
        birth_date: form.birth_date,
        birth_place: form.birth_place || null,
        photo_path: form.photo_path || null,
        blood_type: form.blood_type || null,
      },
    };
  }

  async function saveOffline(payload: RegPayload) {
    if (!localStorage.getItem("wrbh_token")) {
      setError("Connectez-vous une fois en ligne avant d’inscrire hors réseau.");
      return;
    }
    await enqueueRegistration(payload, photoFile);
    setMsg("Enregistré hors ligne — sync dès le retour du Net — محفوظ محلياً");
    clearFormKeepSeason();
    await refreshPending();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (savingRef.current) return; // anti double-clic pendant l'envoi
    if (!form.birth_date) {
      setError("Date de naissance obligatoire");
      return;
    }
    if (!isDzMobile(form.parent_phone)) {
      setError("Téléphone DZ invalide (05/06/07 + 8 chiffres)");
      return;
    }
    if (!form.category_id) {
      setError("Choisissez une catégorie (U7 / U9 / U11 / U13)");
      return;
    }
    if (!form.season_id) {
      setError("Saison introuvable — reconnectez-vous en ligne une fois.");
      return;
    }
    const year = Number(form.birth_date.slice(0, 4));
    if (selectedCat && (year < selectedCat.birth_year_min || year > selectedCat.birth_year_max)) {
      setError(
        `Année ${year} hors ${selectedCat.code} (${selectedCat.birth_year_min}–${selectedCat.birth_year_max})`,
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const playerName = form.full_name;

    // Mode modification d'un dossier existant
    if (editId) {
      try {
        let photoPath = form.photo_path || null;
        if (photoFile) {
          const up = await uploadPhoto(photoFile);
          photoPath = up.path;
        }
        const body: Record<string, unknown> = {
          category_id: form.category_id,
          subscription_fee: Number(form.subscription_fee),
          full_name: form.full_name,
          birth_date: form.birth_date,
          birth_place: form.birth_place || null,
          blood_type: form.blood_type || null,
          parent_phone: form.parent_phone,
        };
        if (form.parent_name) body.parent_name = form.parent_name;
        if (photoPath) body.photo_path = photoPath;
        const updated = await api<Reg>(`/api/v1/registrations/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast(`✓ Dossier « ${playerName} » mis à jour`, "success");
        setMsg("Dossier modifié — تم تعديل الملف");
        setRegs((prev) => prev.map((r) => (r.id === editId ? { ...r, ...updated } : r)));
        clearFormKeepSeason();
        loadRegs({ quiet: true });
      } catch (err) {
        const m = err instanceof Error ? err.message : "Erreur";
        setError(m);
        toast(m, "error");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    const payload = buildPayload();

    if (!online) {
      try {
        await saveOffline({ ...payload, source: "web-offline" });
        toast("Enregistré hors ligne — synchro au retour du réseau", "info");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur stockage local");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    try {
      let photoPath = form.photo_path || null;
      if (photoFile && !photoPath) {
        const up = await uploadPhoto(photoFile);
        photoPath = up.path;
      }
      const body = {
        ...payload,
        photo_path: photoPath,
        athlete: { ...payload.athlete, photo_path: photoPath },
      };
      const res = await api<Reg>("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(`✓ ${playerName || "Joueur"} inscrit avec succès`, "success");
      let info = "Inscription enregistrée — التسجيل محفوظ";
      if (res.parent_created && res.parent_temp_password) {
        info += ` · Compte parent créé ☎ ${res.parent_phone} — mdp temporaire (à noter, changement forcé au 1er login): ${res.parent_temp_password}`;
      } else if (res.parent_phone) {
        info += ` · Parent lié: ${res.parent_phone}`;
      }
      setMsg(info);
      clearFormKeepSeason();
      if (!listCategoryId || listCategoryId === res.category_id) {
        setRegs((prev) => [res, ...prev.filter((x) => x.id !== res.id)].slice(0, PAGE));
      }
      loadRegs({ quiet: true });
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          await saveOffline({ ...payload, source: "web-offline" });
          toast("Enregistré hors ligne — synchro au retour du réseau", "info");
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : "Erreur stockage local");
        }
      } else {
        const m = err instanceof Error ? err.message : "Erreur";
        setError(m);
        // 409 = doublon détecté côté serveur
        toast(m, "error");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function approve(id: number) {
    try {
      const updated = await api<Reg>(`/api/v1/registrations/${id}/approve`, { method: "POST" });
      setRegs((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function archiveReg(id: number, name?: string) {
    const ok = await confirmDialog({
      title: "Archiver le dossier",
      message: `Archiver le dossier « ${name || id} » ?\nIl restera dans l'historique et pourra être restauré.`,
      confirmLabel: "Archiver",
    });
    if (!ok) return;
    try {
      await api(`/api/v1/registrations/${id}/archive`, { method: "POST" });
      setRegs((prev) => prev.filter((r) => r.id !== id));
      if (editId === id) clearFormKeepSeason();
      toast("Dossier archivé — récupérable dans Historique", "success");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setError(m);
      toast(m, "error");
    }
  }

  async function restoreReg(id: number, name?: string) {
    const ok = await confirmDialog({
      title: "Restaurer le dossier",
      message: `Restaurer le dossier « ${name || id} » ?`,
      confirmLabel: "Restaurer",
      danger: false,
    });
    if (!ok) return;
    try {
      await api(`/api/v1/registrations/${id}/restore`, { method: "POST" });
      setRegs((prev) => prev.filter((r) => r.id !== id));
      toast("Dossier restauré (statut en attente)", "success");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setError(m);
      toast(m, "error");
    }
  }

  async function deleteReg(id: number, name?: string) {
    if (!canHardDelete) return;
    const ok = await confirmDialog({
      title: "Supprimer le dossier",
      message: `Supprimer le dossier « ${name || id} » ?\nLa suppression est réversible : le dossier est archivé et reste récupérable depuis Historique.`,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      // Soft-delete (archive) — récupérable
      await api(`/api/v1/registrations/${id}`, { method: "DELETE" });
      setRegs((prev) => prev.filter((r) => r.id !== id));
      if (editId === id) clearFormKeepSeason();
      toast("Dossier supprimé (récupérable dans Historique)", "success");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      setError(m);
      toast(m, "error");
    }
  }

  async function onSyncNow() {
    setMsg("");
    const r = await syncPendingRegistrations();
    await refreshPending();
    if (r.synced) {
      setMsg(`${r.synced} inscription(s) synchronisée(s)`);
      loadRegs({ quiet: true });
    } else if (r.failed) {
      setError(`${r.failed} échec(s) de sync — voir la file locale`);
    } else if (!navigator.onLine) {
      setError("Toujours hors ligne");
    } else if (r.remaining === 0) {
      setMsg("Rien à synchroniser");
    }
  }

  return (
    <div className="split-layout">
      <form className="card" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>
          {editId ? `Modifier dossier #${editId}` : t("newRegistration")}
        </h3>
        {editId && (
          <p className="muted" style={{ marginTop: 0 }}>
            Modification du dossier existant — enregistrez pour appliquer.
          </p>
        )}
        {!online && !editId && (
          <p className="muted" style={{ marginTop: 0 }}>
            Mode hors ligne — l’inscription sera synchronisée plus tard.
          </p>
        )}
        <div className="cat-chips">
          <strong>{t("categories2627")}</strong>
          <div className="chips">
            {seasonCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${form.category_id === c.id ? "active" : ""}`}
                onClick={() => setForm({ ...form, category_id: c.id })}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
          {!seasonCats.length && (
            <p className="muted">Catégories indisponibles — connectez-vous une fois en ligne.</p>
          )}
          <img
            src="/affiche.jpg"
            alt="Affiche inscriptions 2026/2027"
            className="affiche-mini"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="form-split">
          <PhotoCapture
            value={form.photo_path}
            previewUrl={photoPreview}
            onUploaded={(p) => {
              setForm({ ...form, photo_path: p });
              setPhotoFile(null);
              if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
              setPhotoPreview(null);
            }}
            onLocalFile={(file, preview) => {
              setPhotoFile(file);
              setPhotoPreview(preview);
              setForm({ ...form, photo_path: "" });
            }}
          />
          <div>
            <div className="field">
              <label>Nom et prénom / الاسم واللقب</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Date de naissance (jj/mm/aaaa)</label>
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
              <label>Lieu de naissance / مكان الميلاد</label>
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
          </div>
        </div>
        <div className="field">
          <label>Saison</label>
          <select
            value={form.season_id}
            disabled={!!editId}
            onChange={(e) => setForm({ ...form, season_id: Number(e.target.value) })}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>حقوق الاشتراك (DZD)</label>
          <input
            className="ltr"
            inputMode="numeric"
            value={form.subscription_fee}
            onChange={(e) => setForm({ ...form, subscription_fee: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" disabled={saving}>
            {saving ? t("saving") : t("save")}
          </button>
          {editId && (
            <button type="button" className="secondary" onClick={() => clearFormKeepSeason()}>
              {t("cancel")}
            </button>
          )}
        </div>
        {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
        {error && <p style={{ color: "var(--danger, #dc2626)" }}>{error}</p>}
      </form>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ marginTop: 0 }}>{t("files")}</h3>
          <button type="button" className="secondary" onClick={() => loadRegs()}>
            {t("retry")}
          </button>
        </div>

        {pending.length > 0 && (
          <div className="offline-pending-box">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong>
                {pending.length} en attente de sync / بانتظار المزامنة
              </strong>
              <button type="button" className="accent" onClick={() => void onSyncNow()}>
                Synchroniser
              </button>
            </div>
            <ul className="offline-pending-list">
              {pending.map((p) => (
                <li key={p.localId}>
                  <span>
                    {p.payload.athlete.full_name} · {p.payload.parent_phone}
                  </span>
                  <span className={`badge status-${p.status}`}>
                    {p.status === "error" ? p.lastError || "erreur" : p.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cat-chips">
          <strong>Dossiers</strong>
          <div className="chips">
            <button
              type="button"
              className={`chip ${listStatus === "active" ? "active" : ""}`}
              onClick={() => setListStatus("active")}
            >
              Actifs
            </button>
            <button
              type="button"
              className={`chip ${listStatus === "archived" ? "active" : ""}`}
              onClick={() => setListStatus("archived")}
            >
              Archivés
            </button>
          </div>
        </div>
        <div className="cat-chips">
          <strong>{t("filterCategory")}</strong>
          <div className="chips">
            <button
              type="button"
              className={`chip ${listCategoryId === null ? "active" : ""}`}
              onClick={() => setListCategoryId(null)}
            >
              {t("allCategories")}
            </button>
            {seasonCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${listCategoryId === c.id ? "active" : ""}`}
                onClick={() => setListCategoryId(c.id)}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
        </div>
        {(loading || listLoading) && <p className="muted">{t("loading")}</p>}
        {!loading && !listLoading && !regs.length && !error && <p className="muted">{t("empty")}</p>}
        {error && !regs.length && (
          <p style={{ color: "var(--danger, #dc2626)" }}>
            {error}{" "}
            <button type="button" onClick={() => loadRegs()}>
              {t("retry")}
            </button>
          </p>
        )}
        <table>
          <thead>
            <tr>
              <SortHeader label="N°" sortKey="number" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Réf." sortKey="reference" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th>Photo</th>
              <SortHeader label="Athlète" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Cat." sortKey="category" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th>Parent</th>
              <SortHeader label={t("status")} sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td className="ltr">{r.seq_no ?? "—"}</td>
                <td className="ltr" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>
                  {r.reference || "—"}
                </td>
                <td>
                  {r.athlete_photo ? (
                    <img
                      className="avatar"
                      src={mediaUrl(r.athlete_photo)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="avatar placeholder">?</span>
                  )}
                </td>
                <td>{r.athlete_name || `#${r.athlete_id}`}</td>
                <td>{r.category_code || "—"}</td>
                <td>
                  <PhoneCell phone={r.parent_phone} />
                </td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>{r.registered_on ? formatDateFr(r.registered_on) : "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="secondary" onClick={() => openEdit(r)}>
                      {t("edit")}
                    </button>
                    {r.status === "pending" && (
                      <button type="button" onClick={() => approve(r.id)}>
                        OK
                      </button>
                    )}
                    {r.status === "archived" ? (
                      <button type="button" onClick={() => void restoreReg(r.id, r.athlete_name)}>
                        Restaurer
                      </button>
                    ) : (
                      <button type="button" className="secondary" onClick={() => void archiveReg(r.id, r.athlete_name)}>
                        Archiver
                      </button>
                    )}
                    {canHardDelete && (
                      <button type="button" className="danger" onClick={() => void deleteReg(r.id, r.athlete_name)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
