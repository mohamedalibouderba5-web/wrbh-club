import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, wakeServer } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";

type Home = {
  role: string;
  full_name: string;
  club_name: string;
  club_name_ar?: string;
  children_count: number;
  pending_convocations: number;
  unpaid_installments: number;
  upcoming_events: { id: number; title: string; starts_at: string; event_type: string }[];
  announcements: { id: number; title: string; title_ar?: string; body: string }[];
};

export default function HomeScreen() {
  const { fullName, role } = useAuth();
  const [home, setHome] = useState<Home | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await wakeServer().catch(() => undefined);
      setHome(await api<Home>("/api/v1/mobile/home"));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#1E3A8A" />}
    >
      <Text style={styles.h1}>Salam, {fullName}</Text>
      <Text style={styles.ar}>{home?.club_name_ar || "الوداد الرياضي لبلدية حمادي"}</Text>
      <Text style={styles.muted}>Rôle : {role}</Text>

      <View style={styles.row}>
        <View style={styles.stat}><Text style={styles.statN}>{home?.children_count ?? "—"}</Text><Text style={styles.statL}>Enfants</Text></View>
        <View style={styles.stat}><Text style={styles.statN}>{home?.pending_convocations ?? "—"}</Text><Text style={styles.statL}>Convocations</Text></View>
        <View style={styles.stat}><Text style={styles.statN}>{home?.unpaid_installments ?? "—"}</Text><Text style={styles.statL}>Impayés</Text></View>
      </View>

      <Text style={styles.section}>Prochains événements</Text>
      {(home?.upcoming_events || []).map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.cardTitle}>{e.title}</Text>
          <Text style={styles.muted}>{e.event_type} · {new Date(e.starts_at).toLocaleString()}</Text>
        </View>
      ))}
      {!home?.upcoming_events?.length && <Text style={styles.muted}>Aucun événement à venir</Text>}

      <Text style={styles.section}>Annonces</Text>
      {(home?.announcements || []).map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.cardTitle}>{a.title}</Text>
          {!!a.title_ar && <Text style={styles.ar}>{a.title_ar}</Text>}
          <Text style={styles.muted}>{a.body}</Text>
        </View>
      ))}

      <Pressable style={styles.wake} onPress={load}>
        <Text style={styles.wakeText}>Actualiser / Réveiller le serveur</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  h1: { fontSize: 22, fontWeight: "800", color: "#1E3A8A" },
  ar: { color: "#5b6478", textAlign: "left" },
  muted: { color: "#5b6478", marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center" },
  statN: { fontSize: 20, fontWeight: "800", color: "#1E3A8A" },
  statL: { fontSize: 12, color: "#5b6478" },
  section: { marginTop: 8, fontWeight: "800", color: "#0f1f4d", fontSize: 16 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  cardTitle: { fontWeight: "700", color: "#0f1f4d" },
  wake: { marginVertical: 16, alignItems: "center" },
  wakeText: { color: "#1E3A8A", fontWeight: "700" },
});
