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
type Team = { id: number; category_id: number; name: string; code?: string; name_ar?: string };
type Reg = {
  id: number;
  list_number?: number;
  athlete_id: number;
  athlete_name?: string;
  athlete_photo?: string;
  birth_date?: string;
  birth_place?: string;
  blood_type?: string;
  category_code?: string;
  category_id?: number;
  team_id?: number;
  team_code?: string;
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
  created_at?: string;
  kit_number?: number | null;
  has_jersey?: boolean;
  has_backpack?: boolean;
  kit_size?: string | null;
};

type ArchiveMatch = {
  found: boolean;
  from_archive?: boolean;
  athlete?: {
    id: number;
    full_name: string;
    birth_date?: string;
    birth_place?: string;
    blood_type?: string;
    photo_path?: string;
    status?: string;
    previous_parent_phone_hint?: string;
    previous_category_code?: string;
  };
};

const PAGE = 40;
const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function RegistrationsPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const canHardDelete = role === "admin" || role === "direction";
  const canArchiveSeason = role === "admin" || role === "direction";
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [listCategoryId, setListCategoryId] = useState<number | null>(null);
  const [listTeamId, setListTeamId] = useState<number | null>(null);
  const [listStatus, setListStatus] = useState<"active" | "archived">("active");
  const [editId, setEditId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [sortKey, setSortKey] = useState("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [archiveMatch, setArchiveMatch] = useState<ArchiveMatch | null>(null);
  const [reuseAthleteId, setReuseAthleteId] = useState<number | null>(null);
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
    team_id: 0,
    subscription_fee: "4000",
    parent_phone: "",
    parent_name: "",
    photo_path: "",
    blood_type: "",
    kit_number: "",
    kit_size: "",
    has_jersey: false,
    has_backpack: false,
  });

  const seasonCats = useMemo(() => {
    if (!form.season_id) return cats;
    return cats.filter((c) => !c.season_id || c.season_id === form.season_id);
  }, [cats, form.season_id]);

  const selectedCat = seasonCats.find((c) => c.id === form.category_id);
  const categoryTeams = useMemo(
    () => (form.category_id ? teams.filter((t) => t.category_id === form.category_id) : []),
    [teams, form.category_id],
  );
  const listTeams = useMemo(
    () => (listCategoryId ? teams.filter((t) => t.category_id === listCategoryId) : teams),
    [teams, listCategoryId],
  );
  const displayedRegs = useMemo(
    () => (listTeamId ? regs.filter((r) => r.team_id === listTeamId) : regs),
    [regs, listTeamId],
  );
  const archiveSeason = useMemo(
    () => seasons.find((s) => /2025/.test(s.name) && !s.is_current),
    [seasons],
  );

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
      const { data, errors } = await loadAllSettled<
        [Season[], Category[], { inscription_fee_dzd: number }, Team[]]
      >([
        () => apiGetFast<Season[]>("/api/v1/seasons", { ttlMs: 120_000 }),
        () => apiGetFast<Category[]>("/api/v1/categories", { ttlMs: 120_000 }),
        () => apiGetFast<{ inscription_fee_dzd: number }>("/api/v1/finance/settings", { ttlMs: 120_000 }).catch(() => ({
          inscription_fee_dzd: 4000,
        })),
        () => apiGetFast<Team[]>("/api/v1/teams", { ttlMs: 120_000 }),
      ]);
      if (cancelled) return;
      const [s, c, fees, tms] = data;
      if (s) {
        setSeasons(s);
        const current = s.find((x) => x.is_current) || s[0];
        if (current) setForm((f) => ({ ...f, season_id: f.season_id || current.id }));
      }
      if (c) setCats(c);
      if (tms) setTeams(tms);
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
    if (!form.season_id) return;
    let cancelled = false;
    void apiGetFast<Team[]>(`/api/v1/teams?season_id=${form.season_id}`, { ttlMs: 120_000 })
      .then((rows) => {
        if (!cancelled) setTeams(rows);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.season_id]);

  useEffect(() => {
    if (!form.season_id && !seasons.length) return;
    loadRegs();
  }, [loadRegs, form.season_id, seasons.length]);

  function clearFormKeepSeason() {
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditId(null);
    setArchiveMatch(null);
    setReuseAthleteId(null);
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
      team_id: 0,
      kit_number: "",
      kit_size: "",
      has_jersey: false,
      has_backpack: false,
    }));
  }

  function openEdit(r: Reg) {
    setEditId(r.id);
    setError("");
    setMsg("");
    setArchiveMatch(null);
    setReuseAthleteId(null);
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
      team_id: r.team_id || 0,
      subscription_fee: r.subscription_fee != null ? String(r.subscription_fee) : f.subscription_fee,
      parent_phone: r.parent_phone || "",
      parent_name: "",
      photo_path: "",
      blood_type: r.blood_type || "",
      kit_number: r.kit_number != null ? String(r.kit_number) : "",
      kit_size: r.kit_size || "",
      has_jersey: !!r.has_jersey,
      has_backpack: !!r.has_backpack,
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

  // Proposition reprise archive (nom + date naissance)
  useEffect(() => {
    if (editId || !form.full_name.trim() || form.full_name.trim().length < 3 || !form.birth_date) {
      setArchiveMatch(null);
      return;
    }
    const tmr = window.setTimeout(() => {
      void api<ArchiveMatch>(
        `/api/v1/athletes/archive-lookup?full_name=${encodeURIComponent(form.full_name.trim())}&birth_date=${form.birth_date}`,
      )
        .then((res) => {
          if (res.found && res.from_archive) setArchiveMatch(res);
          else if (res.found) setArchiveMatch(res);
          else setArchiveMatch(null);
        })
        .catch(() => setArchiveMatch(null));
    }, 450);
    return () => window.clearTimeout(tmr);
  }, [form.full_name, form.birth_date, editId]);

  // N° équipement auto quand catégorie choisie (création)
  useEffect(() => {
    if (editId || !form.season_id || !form.category_id) return;
    void api<{ next_kit_number: number }>(
      `/api/v1/registrations/next-kit-number?season_id=${form.season_id}&category_id=${form.category_id}`,
    )
      .then((r) => setForm((f) => ({ ...f, kit_number: String(r.next_kit_number) })))
      .catch(() => undefined);
  }, [form.season_id, form.category_id, editId]);

  function applyArchiveReuse() {
    const a = archiveMatch?.athlete;
    if (!a) return;
    setReuseAthleteId(a.id);
    setForm((f) => ({
      ...f,
      full_name: a.full_name || f.full_name,
      birth_date: a.birth_date || f.birth_date,
      birth_place: a.birth_place || "",
      blood_type: a.blood_type || "",
      photo_path: a.photo_path || "",
      // Téléphone + catégorie : saisie manuelle obligatoire
      parent_phone: "",
      parent_name: "",
      category_id: 0,
      team_id: 0,
    }));
    setMsg(
      `Joueur archive repris — saisissez le téléphone parent et la catégorie` +
        (a.previous_parent_phone_hint ? ` (ancien tél. hint: ${a.previous_parent_phone_hint})` : "") +
        (a.previous_category_code ? ` · ancienne cat. ${a.previous_category_code}` : ""),
    );
    setArchiveMatch(null);
  }

  function buildPayload(): RegPayload & { team_id?: number } {
    return {
      season_id: form.season_id,
      category_id: form.category_id || null,
      ...(form.team_id ? { team_id: form.team_id } : {}),
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
          kit_number: form.kit_number ? Number(form.kit_number) : null,
          kit_size: form.kit_size || null,
          has_jersey: form.has_jersey,
          has_backpack: form.has_backpack,
        };
        if (form.parent_name) body.parent_name = form.parent_name;
        if (photoPath) body.photo_path = photoPath;
        if (form.team_id) body.team_id = form.team_id;
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
        athlete_id: reuseAthleteId || undefined,
        kit_number: form.kit_number ? Number(form.kit_number) : undefined,
        kit_size: form.kit_size || null,
        has_jersey: form.has_jersey,
        has_backpack: form.has_backpack,
      };
      const res = await api<Reg>("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(
        `✓ ${playerName || "Joueur"} inscrit — n° équipement ${res.kit_number ?? "—"} (maillot + sac)`,
        "success",
      );
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

  async function deliverKit(r: Reg) {
    const ok = await confirmDialog({
      title: "Remettre équipement",
      message:
        `Remettre maillot + sac à « ${r.athlete_name || r.id} » (n° ${r.kit_number ?? "auto"}) ?\n` +
        `Le stock Matériel sera décrémenté.`,
      confirmLabel: "Remettre",
      danger: false,
    });
    if (!ok) return;
    try {
      const updated = await api<Reg>(
        `/api/v1/registrations/${r.id}/deliver-kit?give_jersey=true&give_backpack=true`,
        { method: "POST" },
      );
      setRegs((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...updated } : x)));
      toast(`Équipement remis — n° ${updated.kit_number}`, "success");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur";
      toast(m, "error");
    }
  }

  async function archiveFirstSeason() {
    if (!archiveSeason || !canArchiveSeason) return;
    const ok = await confirmDialog({
      title: `Archiver saison ${archiveSeason.name}`,
      message:
        `Archiver tous les joueurs de la saison ${archiveSeason.name} ?\n` +
        `Ils n'apparaîtront plus dans les listes actives (uniquement Archives).\n` +
        `À la réinscription, leurs infos pourront être reprises.`,
      confirmLabel: "Archiver la saison",
    });
    if (!ok) return;
    try {
      const res = await api<{
        archived_registrations: number;
        archived_athletes: number;
        season: string;
      }>(`/api/v1/seasons/${archiveSeason.id}/archive-roster`, { method: "POST" });
      toast(
        `Saison ${res.season} archivée — ${res.archived_registrations} dossiers, ${res.archived_athletes} joueurs`,
        "success",
      );
      loadRegs({ quiet: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
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
        {canArchiveSeason && archiveSeason && (
          <div
            className="offline-pending-box"
            style={{ marginBottom: "0.75rem", borderLeft: "4px solid var(--warn, #d97706)" }}
          >
            <strong>Saison {archiveSeason.name}</strong>
            <p className="muted" style={{ margin: "0.35rem 0" }}>
              Archiver les joueurs de la 1ʳᵉ saison (visibles uniquement en Archives).
            </p>
            <button type="button" className="secondary" onClick={() => void archiveFirstSeason()}>
              Archiver le roster {archiveSeason.name}
            </button>
          </div>
        )}
        {archiveMatch?.found && archiveMatch.athlete && !editId && !reuseAthleteId && (
          <div
            className="offline-pending-box"
            style={{ marginBottom: "0.75rem", borderLeft: "4px solid var(--ok, #16a34a)" }}
          >
            <strong>
              {archiveMatch.from_archive ? "Joueur en archive trouvé" : "Joueur déjà connu"}
            </strong>
            <p style={{ margin: "0.35rem 0" }}>
              {archiveMatch.athlete.full_name}
              {archiveMatch.athlete.previous_category_code
                ? ` · cat. ${archiveMatch.athlete.previous_category_code}`
                : ""}
            </p>
            <p className="muted" style={{ margin: "0.25rem 0" }}>
              Reprendre identité (nom, date, lieu). Téléphone parent et catégorie à saisir manuellement.
            </p>
            <button type="button" className="accent" onClick={applyArchiveReuse}>
              Reprendre les infos
            </button>
          </div>
        )}
        {reuseAthleteId && (
          <p className="muted" style={{ color: "var(--ok)" }}>
            Réinscription depuis archive (athlète #{reuseAthleteId}) — téléphone + catégorie obligatoires.
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
                onClick={() => setForm({ ...form, category_id: c.id, team_id: 0 })}
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
        {form.category_id > 0 && categoryTeams.length > 0 && (
          <div className="cat-chips" style={{ marginBottom: "0.75rem" }}>
            <strong>Groupe</strong>
            <div className="chips">
              {categoryTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${form.team_id === t.id ? "active" : ""}`}
                  onClick={() => setForm({ ...form, team_id: t.id })}
                >
                  {t.code || t.name}
                </button>
              ))}
            </div>
          </div>
        )}
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
            <div className="field">
              <label>N° équipement (maillot + sac) / رقم القميص والحقيبة</label>
              <input
                className="ltr"
                inputMode="numeric"
                placeholder="Auto"
                value={form.kit_number}
                onChange={(e) => setForm({ ...form, kit_number: e.target.value })}
              />
              <small className="muted">
                Rempli auto avec le plus petit n° libre de la catégorie — modifiable. À imprimer sur tenue et sac.
              </small>
            </div>
            <div className="field">
              <label>Taille / مقاس</label>
              <input
                placeholder="XS / S / M / L ou pointure"
                value={form.kit_size}
                onChange={(e) => setForm({ ...form, kit_size: e.target.value })}
              />
            </div>
            <div className="field" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.has_jersey}
                  onChange={(e) => setForm({ ...form, has_jersey: e.target.checked })}
                />
                Maillot remis
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.has_backpack}
                  onChange={(e) => setForm({ ...form, has_backpack: e.target.checked })}
                />
                Sac remis
              </label>
            </div>
          </div>
        </div>
        <div className="field">
          <label>Saison</label>
          <select
            value={form.season_id}
            disabled={!!editId}
            onChange={(e) => setForm({ ...form, season_id: Number(e.target.value), team_id: 0 })}
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
              onClick={() => {
                setListCategoryId(null);
                setListTeamId(null);
              }}
            >
              {t("allCategories")}
            </button>
            {seasonCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${listCategoryId === c.id ? "active" : ""}`}
                onClick={() => {
                  setListCategoryId(c.id);
                  setListTeamId(null);
                }}
              >
                {c.code}
                <small>
                  {c.birth_year_min}-{c.birth_year_max}
                </small>
              </button>
            ))}
          </div>
        </div>
        {listTeams.length > 0 && (
          <div className="cat-chips">
            <strong>Sous-groupe</strong>
            <div className="chips">
              <button
                type="button"
                className={`chip ${listTeamId === null ? "active" : ""}`}
                onClick={() => setListTeamId(null)}
              >
                Tous les groupes
              </button>
              {listTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${listTeamId === t.id ? "active" : ""}`}
                  onClick={() => setListTeamId(t.id)}
                >
                  {t.code || t.name}
                  <small>{t.name}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {(loading || listLoading) && <p className="muted">{t("loading")}</p>}
        {!loading && !listLoading && !displayedRegs.length && !error && <p className="muted">{t("empty")}</p>}
        {error && !displayedRegs.length && (
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
              <SortHeader label="N° joueur" sortKey="number" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Kit" sortKey="kit" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Réf." sortKey="reference" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th>Photo</th>
              <SortHeader label="Athlète" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Cat." sortKey="category" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th>Équip.</th>
              <th>Parent</th>
              <SortHeader label={t("status")} sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedRegs.map((r) => (
              <tr key={r.id}>
                <td className="ltr" title={`Identité historique : ${r.reference || "—"}`}>
                  {r.list_number ?? "—"}
                </td>
                <td className="ltr" style={{ fontWeight: 700 }}>
                  {r.kit_number ?? "—"}
                </td>
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
                <td>
                  {r.category_code || "—"}
                  {r.team_code && (
                    <small className="muted" style={{ display: "block" }}>
                      {r.team_code}
                    </small>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap", fontSize: "0.85em" }}>
                  {r.has_jersey ? "Maillot✓" : "Maillot—"} · {r.has_backpack ? "Sac✓" : "Sac—"}
                </td>
                <td>
                  <PhoneCell phone={r.parent_phone} />
                </td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td className="ltr" style={{ whiteSpace: "nowrap" }}>
                  {r.created_at
                    ? new Intl.DateTimeFormat("fr-DZ", {
                        timeZone: "Africa/Algiers",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(new Date(r.created_at))
                    : r.registered_on
                      ? formatDateFr(r.registered_on)
                      : "—"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="secondary" onClick={() => openEdit(r)}>
                      {t("edit")}
                    </button>
                    {(!r.has_jersey || !r.has_backpack) && r.status !== "archived" && (
                      <button type="button" className="accent" onClick={() => void deliverKit(r)}>
                        Remettre kit
                      </button>
                    )}
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
