import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";

type EventRow = { id: number; title: string; event_type: string; starts_at: string; opponent?: string };
type Conv = { id: number; event_id: number; athlete_id: number; status: string };

export default function AgendaScreen() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);

  const load = useCallback(async () => {
    const [e, c] = await Promise.all([
      api<EventRow[]>("/api/v1/events"),
      api<Conv[]>("/api/v1/convocations"),
    ]);
    setEvents(e);
    setConvs(c.filter((x) => x.status === "pending"));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(id: number, status: "confirmed" | "declined") {
    await api(`/api/v1/convocations/${id}/respond?status=${status}`, { method: "POST" });
    load();
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={styles.section}>Convocations à confirmer</Text>
      {convs.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.title}>Convocation #{c.id} — joueur #{c.athlete_id}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable style={styles.ok} onPress={() => respond(c.id, "confirmed")}><Text style={styles.okT}>Confirmer</Text></Pressable>
            <Pressable style={styles.no} onPress={() => respond(c.id, "declined")}><Text style={styles.noT}>Décliner</Text></Pressable>
          </View>
        </View>
      ))}
      {!convs.length && <Text style={styles.muted}>Aucune convocation en attente</Text>}

      <Text style={styles.section}>Agenda</Text>
      {events.map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.title}>{e.title}</Text>
          <Text style={styles.muted}>{e.event_type} · {new Date(e.starts_at).toLocaleString()}</Text>
          {!!e.opponent && <Text style={styles.muted}>vs {e.opponent}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  section: { fontWeight: "800", color: "#1E3A8A", fontSize: 16, marginTop: 6 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  title: { fontWeight: "700", color: "#0f1f4d" },
  muted: { color: "#5b6478", marginTop: 2 },
  ok: { backgroundColor: "#1E3A8A", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  okT: { color: "white", fontWeight: "700" },
  no: { backgroundColor: "#fde8e8", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  noT: { color: "#a33", fontWeight: "700" },
});
