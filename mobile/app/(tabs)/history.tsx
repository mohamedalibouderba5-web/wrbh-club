import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtDate } from "../../src/theme";

type Audit = {
  id: number;
  action: string;
  entity: string;
  entity_id?: number;
  detail?: string;
  user_name?: string;
  created_at?: string;
};

export default function HistoryScreen() {
  const { role } = useAuth();
  const canView = role === "admin" || role === "direction" || role === "staff";
  const [rows, setRows] = useState<Audit[]>([]);
  const [entity, setEntity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    const q = entity ? `?entity=${encodeURIComponent(entity)}&limit=80` : "?limit=80";
    api<Audit[]>(`/api/v1/audit${q}`)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [canView, entity]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!canView) {
    return (
      <View style={[styles.page, { padding: 16 }]}>
        <Text style={styles.h}>Historique</Text>
        <Text style={styles.muted}>Réservé au staff.</Text>
      </View>
    );
  }

  const filters = [
    [null, "Tout"],
    ["athlete", "Athlètes"],
    ["registration", "Inscriptions"],
    ["payment", "Paiements"],
    ["event", "Agenda"],
    ["inventory", "Matériel"],
    ["ledger", "Caisse"],
  ] as const;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Historique / Audit</Text>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}

      <View style={styles.chips}>
        {filters.map(([id, label]) => (
          <Pressable
            key={label}
            style={[styles.chip, entity === id && styles.chipOn]}
            onPress={() => setEntity(id)}
          >
            <Text style={[styles.chipText, entity === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>
              {r.action} · {r.entity}
              {r.entity_id != null ? ` #${r.entity_id}` : ""}
            </Text>
          </View>
          {!!r.detail && <Text style={styles.line}>{r.detail}</Text>}
          <Text style={styles.muted}>
            {r.user_name || "Système"} · {fmtDate(r.created_at)}
          </Text>
        </View>
      ))}
      {!rows.length && !loading && <Text style={styles.muted}>Aucun événement</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4 },
  cardHead: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontWeight: "800", color: colors.navy, fontSize: 14, flex: 1 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  line: { color: "#334155", fontSize: 14, lineHeight: 20 },
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
  err: { color: colors.danger, fontWeight: "700" },
});
