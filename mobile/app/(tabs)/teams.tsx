import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme";

type Coach = { id: number; full_name: string; role?: string };
type TeamCoach = { user_id: number; full_name?: string; role_label?: string };
type TeamRow = {
  id: number;
  name: string;
  name_ar?: string;
  category_code?: string;
  coaches?: TeamCoach[];
};

export default function TeamsScreen() {
  const { role } = useAuth();
  const canAssign = role === "admin" || role === "direction" || role === "staff";
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    setErr("");
    Promise.all([
      api<TeamRow[]>("/api/v1/teams/coaches").catch(() =>
        api<TeamRow[]>("/api/v1/teams").catch(() => [] as TeamRow[]),
      ),
      canAssign
        ? api<Coach[]>("/api/v1/coaches").catch(() => [] as Coach[])
        : Promise.resolve([] as Coach[]),
    ])
      .then(([t, c]) => {
        setTeams(t);
        setCoaches(c);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [canAssign]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function openTeam(t: TeamRow) {
    setSelected(t.id);
    setPicked((t.coaches || []).map((c) => c.user_id));
    setMsg("");
  }

  function toggleCoach(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!selected || !canAssign || saving) return;
    setSaving(true);
    setErr("");
    try {
      await api(`/api/v1/teams/${selected}/coaches`, {
        method: "PUT",
        body: JSON.stringify({
          coaches: picked.map((user_id, i) => ({
            user_id,
            is_primary: i === 0,
            role_label: i === 0 ? "primary" : "coach",
          })),
        }),
      });
      setMsg("Coachs mis à jour");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Équipes / Coachs</Text>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      {teams.map((t) => (
        <Pressable
          key={t.id}
          style={[styles.card, selected === t.id && styles.cardOn]}
          onPress={() => openTeam(t)}
        >
          <Text style={styles.title}>{t.name}</Text>
          {!!t.name_ar && <Text style={styles.ar}>{t.name_ar}</Text>}
          <Text style={styles.line}>{t.category_code || "—"}</Text>
          <Text style={styles.muted}>
            {(t.coaches || []).map((c) => c.full_name || `#${c.user_id}`).join(", ") || "Aucun coach"}
          </Text>
        </Pressable>
      ))}
      {!teams.length && !loading && <Text style={styles.muted}>Aucune équipe</Text>}

      {canAssign && selected != null && (
        <View style={styles.card}>
          <Text style={styles.title}>Affecter des coachs</Text>
          {coaches.map((c) => {
            const on = picked.includes(c.id);
            return (
              <Pressable key={c.id} style={[styles.row, on && styles.rowOn]} onPress={() => toggleCoach(c.id)}>
                <Text style={styles.rowText}>
                  {on ? "✓ " : ""}
                  {c.full_name}
                </Text>
              </Pressable>
            );
          })}
          {!coaches.length && <Text style={styles.muted}>Aucun coach dans le club</Text>}
          <Pressable style={styles.btn} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>{saving ? "…" : "Enregistrer"}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4 },
  cardOn: { borderWidth: 2, borderColor: colors.blue },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15 },
  ar: { color: colors.muted, fontSize: 13 },
  line: { color: "#334155", fontSize: 14 },
  muted: { color: colors.muted, lineHeight: 18 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.softGray,
    marginTop: 6,
  },
  rowOn: { backgroundColor: colors.softBlue },
  rowText: { fontWeight: "600", color: "#0f172a" },
  btn: { marginTop: 12, backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  ok: { color: "#16a34a", fontWeight: "700" },
  err: { color: colors.danger, fontWeight: "700" },
});
