import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { PhotoPicker } from "../../src/components/PhotoPicker";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtMoney, statusColor, statusLabel } from "../../src/theme";
import { API_BASE } from "../../src/config";

type Season = { id: number; name: string; is_current?: boolean; registration_open?: boolean };
type Category = { id: number; code: string; season_id?: number };
type Reg = {
  id: number;
  list_number?: number;
  kit_number?: number | null;
  athlete_id: number;
  athlete_name?: string;
  season_id: number;
  category_id?: number;
  category_code?: string;
  status: string;
  registered_on?: string;
  created_at?: string;
  reference?: string;
  subscription_fee?: number;
  parent_phone?: string;
  source?: string;
};

function fmtCreatedAt(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleString("fr-DZ", {
      timeZone: "Africa/Algiers",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

const emptyForm = {
  full_name: "",
  birth_date: "",
  parent_phone: "",
  parent_name: "",
  category_id: 0,
  subscription_fee: "",
  status: "pending",
  photo_path: "",
};

export default function RegistrationsScreen() {
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "direction" || role === "staff";
  const canDelete = role === "admin" || role === "direction";
  const [rows, setRows] = useState<Reg[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [seasonId, setSeasonId] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr("");
    Promise.all([
      api<Season[]>("/api/v1/seasons").catch(() => [] as Season[]),
      api<Category[]>("/api/v1/categories").catch(() => [] as Category[]),
    ])
      .then(([ss, cc]) => {
        setSeasons(ss);
        setCats(cc);
        const current = ss.find((s) => s.is_current) || ss[0];
        const sid = seasonId || current?.id || 0;
        if (!seasonId && sid) setSeasonId(sid);
        const statusQ =
          filter === "all" ? "" : filter === "archived" ? "&status=archived" : `&status=${filter}`;
        const seasonQ = sid ? `season_id=${sid}` : "";
        return api<Reg[]>(`/api/v1/registrations?${seasonQ}&limit=100${statusQ}`);
      })
      .then((regs) => setRows(regs || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [seasonId, filter]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const seasonCats = useMemo(
    () => cats.filter((c) => !seasonId || c.season_id === seasonId),
    [cats, seasonId],
  );

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMsg("");
  }

  function openEdit(r: Reg) {
    setEditId(r.id);
    setForm({
      full_name: r.athlete_name || "",
      birth_date: "",
      parent_phone: r.parent_phone || "",
      parent_name: "",
      category_id: r.category_id || 0,
      subscription_fee: r.subscription_fee != null ? String(r.subscription_fee) : "",
      status: r.status || "pending",
      photo_path: "",
    });
    setShowForm(true);
    setMsg("");
  }

  async function act(id: number, action: "approve" | "reject" | "archive" | "restore") {
    setErr("");
    setMsg("");
    try {
      await api(`/api/v1/registrations/${id}/${action}`, { method: "POST", body: "{}" });
      setMsg(
        action === "approve"
          ? "Inscription validée"
          : action === "reject"
            ? "Inscription refusée"
            : action === "archive"
              ? "Archivée"
              : "Restaurée",
      );
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  function confirmDelete(r: Reg) {
    Alert.alert(
      "Supprimer l’inscription",
      `Supprimer définitivement « ${r.athlete_name || `#${r.id}`} » ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => void onDelete(r.id),
        },
      ],
    );
  }

  async function onDelete(id: number) {
    setErr("");
    setMsg("");
    try {
      await api(`/api/v1/registrations/${id}`, { method: "DELETE" });
      setMsg("Inscription supprimée");
      if (editId === id) {
        setShowForm(false);
        setEditId(null);
      }
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onSave() {
    if (!form.full_name.trim() || saving) return;
    if (!editId && !seasonId) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          full_name: form.full_name.trim(),
          parent_phone: form.parent_phone.trim() || null,
          parent_name: form.parent_name.trim() || null,
          category_id: form.category_id || null,
          status: form.status,
        };
        if (form.birth_date.trim()) body.birth_date = form.birth_date.trim();
        if (form.subscription_fee.trim() !== "") body.subscription_fee = Number(form.subscription_fee);
        if (form.photo_path) body.photo_path = form.photo_path;
        await api(`/api/v1/registrations/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMsg("Inscription mise à jour");
      } else {
        await api("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({
            season_id: seasonId,
            category_id: form.category_id || null,
            parent_phone: form.parent_phone.trim() || null,
            parent_name: form.parent_name.trim() || null,
            photo_path: form.photo_path || null,
            source: "mobile",
            athlete: {
              full_name: form.full_name.trim(),
              birth_date: form.birth_date.trim() || null,
              parent_phone: form.parent_phone.trim() || null,
              photo_path: form.photo_path || null,
            },
          }),
        });
        setMsg("Inscription créée");
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={styles.head}>
        <Text style={styles.h}>Inscriptions</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            if (showForm) {
              setShowForm(false);
              setEditId(null);
            } else openCreate();
          }}
        >
          <Text style={styles.addText}>{showForm ? "Fermer" : "+ Nouvelle"}</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      <Text style={styles.label}>Saison</Text>
      <View style={styles.chips}>
        {seasons.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.chip, seasonId === s.id && styles.chipOn]}
            onPress={() => setSeasonId(s.id)}
          >
            <Text style={[styles.chipText, seasonId === s.id && styles.chipTextOn]}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chips}>
        {(
          [
            ["all", "Actives"],
            ["pending", "En attente"],
            ["approved", "Validées"],
            ["archived", "Archivées"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.chip, filter === id && styles.chipOn]} onPress={() => setFilter(id)}>
            <Text style={[styles.chipText, filter === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.title}>{editId ? "Modifier l’inscription" : "Nouvelle inscription"}</Text>
          <PhotoPicker
            value={form.photo_path ? `${API_BASE}${form.photo_path}` : null}
            onUploaded={(path) => setForm((f) => ({ ...f, photo_path: path }))}
          />
          <Text style={styles.label}>Nom du joueur *</Text>
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(t) => setForm((f) => ({ ...f, full_name: t }))}
          />
          <Text style={styles.label}>Naissance (AAAA-MM-JJ)</Text>
          <TextInput
            style={styles.input}
            value={form.birth_date}
            onChangeText={(t) => setForm((f) => ({ ...f, birth_date: t }))}
            placeholder="2016-05-12"
          />
          <Text style={styles.label}>Parent / téléphone</Text>
          <TextInput
            style={styles.input}
            value={form.parent_name}
            onChangeText={(t) => setForm((f) => ({ ...f, parent_name: t }))}
            placeholder="Nom parent"
          />
          <TextInput
            style={styles.input}
            value={form.parent_phone}
            onChangeText={(t) => setForm((f) => ({ ...f, parent_phone: t }))}
            placeholder="05…"
            keyboardType="phone-pad"
          />
          {!!editId && (
            <>
              <Text style={styles.label}>Frais inscription (DZD)</Text>
              <TextInput
                style={styles.input}
                value={form.subscription_fee}
                onChangeText={(t) => setForm((f) => ({ ...f, subscription_fee: t }))}
                keyboardType="numeric"
              />
              <Text style={styles.label}>Statut</Text>
              <View style={styles.chips}>
                {(["pending", "approved", "rejected", "archived"] as const).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.chip, form.status === s && styles.chipOn]}
                    onPress={() => setForm((f) => ({ ...f, status: s }))}
                  >
                    <Text style={[styles.chipText, form.status === s && styles.chipTextOn]}>{statusLabel(s)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.chips}>
            {seasonCats.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, form.category_id === c.id && styles.chipOn]}
                onPress={() => setForm((f) => ({ ...f, category_id: c.id }))}
              >
                <Text style={[styles.chipText, form.category_id === c.id && styles.chipTextOn]}>{c.code}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.btn} onPress={onSave} disabled={saving}>
            <Text style={styles.btnText}>{saving ? "…" : editId ? "Enregistrer" : "Soumettre"}</Text>
          </Pressable>
        </View>
      )}

      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>{r.athlete_name || `Athlète #${r.athlete_id}`}</Text>
            <Text style={[styles.badge, { color: statusColor(r.status) }]}>{statusLabel(r.status)}</Text>
          </View>
          <Text style={styles.line}>
            {[
              r.list_number != null ? `N° joueur ${r.list_number}` : undefined,
              r.kit_number != null ? `Kit ${r.kit_number}` : undefined,
              r.category_code,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {!!r.reference && <Text style={styles.line}>Réf. {r.reference}</Text>}
          <Text style={styles.line}>
            Créé le {fmtCreatedAt(r.created_at) || r.registered_on || "—"}
          </Text>
          {!!r.parent_phone && <Text style={styles.line}>Tél. {r.parent_phone}</Text>}
          {r.subscription_fee != null && <Text style={styles.line}>{fmtMoney(r.subscription_fee)}</Text>}
          {isStaff && (
            <View style={styles.actions}>
              <Pressable style={styles.miniBtn} onPress={() => openEdit(r)}>
                <Text style={styles.miniText}>Modifier</Text>
              </Pressable>
              {r.status === "pending" && (
                <>
                  <Pressable style={styles.miniBtn} onPress={() => act(r.id, "approve")}>
                    <Text style={styles.miniText}>Valider</Text>
                  </Pressable>
                  <Pressable style={[styles.miniBtn, styles.dangerBtn]} onPress={() => act(r.id, "reject")}>
                    <Text style={styles.miniText}>Refuser</Text>
                  </Pressable>
                </>
              )}
              {r.status !== "archived" ? (
                <Pressable style={[styles.miniBtn, styles.ghostBtn]} onPress={() => act(r.id, "archive")}>
                  <Text style={[styles.miniText, { color: colors.muted }]}>Archiver</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.miniBtn} onPress={() => act(r.id, "restore")}>
                  <Text style={styles.miniText}>Restaurer</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable style={[styles.miniBtn, styles.dangerBtn]} onPress={() => confirmDelete(r)}>
                  <Text style={styles.miniText}>Supprimer</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ))}
      {!rows.length && !loading && <Text style={styles.muted}>Aucune inscription</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  addBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: "white", fontWeight: "800" },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15, flex: 1 },
  muted: { color: colors.muted },
  line: { color: "#334155", fontSize: 14 },
  badge: { fontWeight: "800", fontSize: 12 },
  label: { fontWeight: "700", color: "#334155", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.softGray,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "white" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.softGray,
    marginTop: 6,
    fontSize: 15,
  },
  btn: { marginTop: 12, backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  miniBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dangerBtn: { backgroundColor: colors.danger },
  ghostBtn: { backgroundColor: colors.softGray, borderWidth: 1, borderColor: colors.border },
  miniText: { color: "white", fontWeight: "700", fontSize: 13 },
  ok: { color: "#16a34a", fontWeight: "700" },
  err: { color: colors.danger, fontWeight: "700" },
});
