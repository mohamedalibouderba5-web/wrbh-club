import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { colors, statusLabel } from "../../src/theme";

type UserRow = {
  id: number;
  full_name: string;
  full_name_ar?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  is_active: boolean;
};

const emptyForm = {
  full_name: "",
  full_name_ar: "",
  email: "",
  phone: "",
  role: "coach",
  password: "",
};

export default function UsersScreen() {
  const { role: myRole } = useAuth();
  const canManage = myRole === "admin" || myRole === "direction";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tempPassword, setTempPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const roleOptions = useMemo(() => {
    const base = ["direction", "staff", "coach", "parent"];
    return myRole === "admin" ? ["admin", ...base] : base;
  }, [myRole]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setErr("");
    try {
      setUsers(await api<UserRow[]>("/api/v1/auth/users"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur chargement comptes");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    if (filter === "all") return users;
    return users.filter((u) => u.role === filter);
  }, [users, filter]);

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
    setTempPassword("");
    setShowForm(false);
  }

  function startEdit(u: UserRow) {
    setEditId(u.id);
    setForm({
      full_name: u.full_name || "",
      full_name_ar: u.full_name_ar || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role,
      password: "",
    });
    setTempPassword("");
    setShowForm(true);
    setMsg("");
  }

  async function onSave() {
    if (!canManage || busy) return;
    if (!form.full_name.trim()) {
      setErr("Nom obligatoire");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          full_name: form.full_name.trim(),
          full_name_ar: form.full_name_ar.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
        };
        if (form.password.trim()) body.password = form.password.trim();
        await api(`/api/v1/auth/users/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        setMsg("Compte mis à jour");
        resetForm();
      } else {
        const pwd = form.password.trim() || `Wr!${Math.floor(100000 + Math.random() * 900000)}`;
        await api("/api/v1/auth/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            full_name_ar: form.full_name_ar.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role: form.role,
            password: pwd,
            locale: "fr",
          }),
        });
        setTempPassword(pwd);
        setForm(emptyForm);
        setEditId(null);
        setMsg("Compte créé — notez le mot de passe temporaire");
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserRow) {
    if (!canManage || u.role === "admin") return;
    setBusy(true);
    try {
      await api(`/api/v1/auth/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>Accès réservé à la direction.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Text style={styles.h}>Comptes / الحسابات</Text>
      <Text style={styles.muted}>Créer et gérer admin, direction, staff, coach, parent.</Text>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}
      {!!tempPassword && (
        <View style={styles.warn}>
          <Text style={styles.warnT}>Mot de passe temporaire : {tempPassword}</Text>
        </View>
      )}

      <Pressable
        style={styles.primary}
        onPress={() => {
          if (showForm && !editId) resetForm();
          else {
            setEditId(null);
            setForm(emptyForm);
            setShowForm(true);
            setTempPassword("");
          }
        }}
      >
        <Text style={styles.primaryT}>{showForm && !editId ? "Fermer" : "+ Nouveau compte"}</Text>
      </Pressable>

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.section}>{editId ? "Modifier" : "Créer"}</Text>
          {(
            [
              ["full_name", "Nom complet"],
              ["full_name_ar", "Nom (AR)"],
              ["email", "Email"],
              ["phone", "Téléphone"],
              ["password", editId ? "Nouveau mot de passe (optionnel)" : "Mot de passe (auto si vide)"],
            ] as const
          ).map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[key]}
                onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
                autoCapitalize={key === "email" ? "none" : "words"}
                secureTextEntry={key === "password"}
                keyboardType={key === "phone" ? "phone-pad" : key === "email" ? "email-address" : "default"}
              />
            </View>
          ))}
          <Text style={styles.label}>Rôle</Text>
          <View style={styles.chips}>
            {roleOptions.map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, form.role === r && styles.chipOn]}
                onPress={() => setForm((f) => ({ ...f, role: r }))}
              >
                <Text style={[styles.chipT, form.role === r && styles.chipTOn]}>{statusLabel(r)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primary} onPress={onSave} disabled={busy}>
            <Text style={styles.primaryT}>{busy ? "…" : editId ? "Enregistrer" : "Créer"}</Text>
          </Pressable>
          {editId && (
            <Pressable onPress={resetForm}>
              <Text style={styles.link}>Annuler l’édition</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {["all", "admin", "direction", "staff", "coach", "parent"].map((r) => (
          <Pressable key={r} style={[styles.chip, filter === r && styles.chipOn]} onPress={() => setFilter(r)}>
            <Text style={[styles.chipT, filter === r && styles.chipTOn]}>
              {r === "all" ? "Tous" : statusLabel(r)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map((u) => (
        <View key={u.id} style={[styles.card, !u.is_active && { opacity: 0.55 }]}>
          <Text style={styles.title}>{u.full_name}</Text>
          {!!u.full_name_ar && <Text style={styles.muted}>{u.full_name_ar}</Text>}
          <Text style={styles.meta}>
            {statusLabel(u.role)} · {u.is_active ? "Actif" : "Inactif"}
          </Text>
          <Text style={styles.muted}>{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.mini} onPress={() => startEdit(u)}>
              <Text style={styles.miniT}>Modifier</Text>
            </Pressable>
            {u.role !== "admin" && (
              <Pressable style={[styles.mini, !u.is_active && styles.miniOk]} onPress={() => toggleActive(u)}>
                <Text style={styles.miniT}>{u.is_active ? "Désactiver" : "Réactiver"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {!loading && !filtered.length && <Text style={styles.muted}>Aucun compte</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 22, fontWeight: "800", color: colors.blue },
  muted: { color: colors.muted, lineHeight: 19 },
  err: { color: colors.danger, fontWeight: "700" },
  ok: { color: colors.success, fontWeight: "700" },
  warn: { backgroundColor: colors.softGold, borderRadius: 12, padding: 12 },
  warnT: { color: colors.navy, fontWeight: "800" },
  primary: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryT: { color: "white", fontWeight: "800" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  label: { color: colors.muted, fontWeight: "700", marginTop: 6, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.softGray,
    color: colors.navy,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.softGray,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipT: { color: colors.navy, fontWeight: "700", fontSize: 12 },
  chipTOn: { color: "white" },
  title: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  meta: { color: colors.blue, fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  mini: {
    backgroundColor: colors.softBlue,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniOk: { backgroundColor: "#bbf7d0" },
  miniT: { color: colors.navy, fontWeight: "800", fontSize: 13 },
  link: { color: colors.blue, fontWeight: "700", textAlign: "center", marginTop: 8 },
});
