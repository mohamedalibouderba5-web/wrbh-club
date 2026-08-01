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
import { useAuth } from "../../src/context/AuthContext";
import { colors, statusColor, statusLabel } from "../../src/theme";

type Athlete = {
  id: number;
  full_name: string;
  full_name_ar?: string;
  status: string;
  category_code?: string;
  category_id?: number;
  birth_date?: string;
  parent_phone?: string;
  blood_type?: string;
  license_number?: string;
  legacy_number?: number;
  notes?: string;
};

const emptyForm = {
  full_name: "",
  full_name_ar: "",
  birth_date: "",
  parent_phone: "",
  blood_type: "",
  status: "Active",
  license_number: "",
  notes: "",
};

export default function AthletesScreen() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "direction" || role === "staff";
  const canDelete = role === "admin" || role === "direction";
  const [rows, setRows] = useState<Athlete[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr("");
    api<Athlete[]>("/api/v1/athletes?limit=300&sort=name&order=asc")
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.full_name.toLowerCase().includes(q) ||
        (a.full_name_ar || "").includes(q) ||
        (a.category_code || "").toLowerCase().includes(q) ||
        (a.parent_phone || "").includes(q) ||
        String(a.legacy_number || "").includes(q),
    );
  }, [rows, search]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMsg("");
  }

  function openEdit(a: Athlete) {
    setEditId(a.id);
    setForm({
      full_name: a.full_name || "",
      full_name_ar: a.full_name_ar || "",
      birth_date: a.birth_date || "",
      parent_phone: a.parent_phone || "",
      blood_type: a.blood_type || "",
      status: a.status || "Active",
      license_number: a.license_number || "",
      notes: a.notes || "",
    });
    setShowForm(true);
    setMsg("");
  }

  async function onSave() {
    if (!form.full_name.trim() || saving) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const leaving = ["Abandonne", "Left", "Inactif"].includes(form.status);
      const body: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        full_name_ar: form.full_name_ar.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        blood_type: form.blood_type.trim() || null,
        license_number: form.license_number.trim() || null,
        status: form.status || "Active",
        notes: form.notes.trim() || null,
      };
      if (form.birth_date.trim()) body.birth_date = form.birth_date.trim();
      if (editId) {
        if (leaving) body.confirm_status = true;
        await api(`/api/v1/athletes/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        setMsg("Athlète mis à jour");
      } else {
        await api("/api/v1/athletes", { method: "POST", body: JSON.stringify(body) });
        setMsg("Athlète créé");
      }
      setShowForm(false);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  function confirmArchive(a: Athlete) {
    Alert.alert(
      "Archiver l’athlète",
      `Passer « ${a.full_name} » en statut Abandonne ? Récupérable via le filtre statut.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Archiver", style: "destructive", onPress: () => void onArchive(a) },
      ],
    );
  }

  async function onArchive(a: Athlete) {
    setErr("");
    setMsg("");
    try {
      await api(`/api/v1/athletes/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Abandonne",
          confirm_status: true,
          notes: a.notes || `Archivé mobile ${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      setMsg("Athlète archivé (Abandonne)");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  function confirmDelete(a: Athlete) {
    Alert.alert(
      "Supprimer l’athlète",
      `Supprimer définitivement « ${a.full_name} » ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => void onDelete(a.id) },
      ],
    );
  }

  async function onDelete(id: number) {
    setErr("");
    setMsg("");
    try {
      await api(`/api/v1/athletes/${id}`, { method: "DELETE" });
      setMsg("Athlète supprimé");
      if (editId === id) {
        setShowForm(false);
        setEditId(null);
      }
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={styles.head}>
        <Text style={styles.h}>Athlètes</Text>
        {canEdit && (
          <Pressable style={styles.addBtn} onPress={openCreate}>
            <Text style={styles.addText}>+ Ajouter</Text>
          </Pressable>
        )}
      </View>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Rechercher nom, catégorie, téléphone…"
        value={search}
        onChangeText={setSearch}
      />

      {showForm && canEdit && (
        <View style={styles.card}>
          <Text style={styles.title}>{editId ? "Modifier" : "Nouvel athlète"}</Text>
          {(
            [
              ["full_name", "Nom complet *"],
              ["full_name_ar", "Nom arabe"],
              ["birth_date", "Naissance (AAAA-MM-JJ)"],
              ["parent_phone", "Tél. parent"],
              ["blood_type", "Groupe sanguin"],
              ["license_number", "N° licence"],
              ["status", "Statut (Active / Abandonne…)"],
              ["notes", "Notes"],
            ] as const
          ).map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[key]}
                onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
              />
            </View>
          ))}
          <View style={styles.rowBtns}>
            <Pressable style={styles.btnGhost} onPress={() => setShowForm(false)}>
              <Text style={styles.btnGhostText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onSave} disabled={saving}>
              <Text style={styles.btnText}>{saving ? "…" : "Enregistrer"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.muted}>{visible.length} athlète(s)</Text>
      {visible.map((a) => (
        <View key={a.id} style={styles.card}>
          <Pressable onPress={() => canEdit && openEdit(a)}>
            <View style={styles.cardHead}>
              <Text style={styles.title}>{a.full_name}</Text>
              <Text style={[styles.badge, { color: statusColor(a.status) }]}>{statusLabel(a.status)}</Text>
            </View>
            {!!a.full_name_ar && <Text style={styles.ar}>{a.full_name_ar}</Text>}
            <Text style={styles.line}>
              {[a.category_code, a.legacy_number ? `#${a.legacy_number}` : null, a.birth_date]
                .filter(Boolean)
                .join(" · ") || "—"}
            </Text>
            {!!a.parent_phone && <Text style={styles.line}>Tél. {a.parent_phone}</Text>}
            {canEdit && <Text style={styles.hint}>Appuyer pour modifier</Text>}
          </Pressable>
          {canEdit && (
            <View style={styles.actions}>
              <Pressable style={styles.miniBtn} onPress={() => openEdit(a)}>
                <Text style={styles.miniText}>Modifier</Text>
              </Pressable>
              {a.status !== "Abandonne" && (
                <Pressable style={[styles.miniBtn, styles.ghostBtn]} onPress={() => confirmArchive(a)}>
                  <Text style={[styles.miniText, { color: colors.muted }]}>Archiver</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable style={[styles.miniBtn, styles.dangerBtn]} onPress={() => confirmDelete(a)}>
                  <Text style={styles.miniText}>Supprimer</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ))}
      {!visible.length && !loading && <Text style={styles.muted}>Aucun athlète</Text>}
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
  ar: { color: colors.muted, fontSize: 13 },
  badge: { fontWeight: "800", fontSize: 12 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  label: { marginTop: 8, fontWeight: "700", color: "#334155", fontSize: 13 },
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
  rowBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  btnGhost: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: { fontWeight: "700", color: colors.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  miniBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dangerBtn: { backgroundColor: colors.danger },
  ghostBtn: { backgroundColor: colors.softGray, borderWidth: 1, borderColor: colors.border },
  miniText: { color: "white", fontWeight: "700", fontSize: 13 },
  ok: { color: "#16a34a", fontWeight: "700" },
  err: { color: colors.danger, fontWeight: "700" },
});
