import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, wakeServer } from "../../src/api/client";
import { mediaUrl } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";

type Child = {
  id: number;
  full_name: string;
  birth_date?: string;
  status: string;
  legacy_number?: number;
  blood_type?: string;
  photo_path?: string;
  category_code?: string;
};

type Home = {
  role: string;
  full_name: string;
  club_name: string;
  club_name_ar?: string;
  children_count: number;
  children?: Child[];
  pending_convocations: number;
  unpaid_installments: number;
  upcoming_events: { id: number; title: string; starts_at: string; event_type: string; location?: string }[];
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

  const isParent = role === "parent";

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
        <View style={styles.stat}>
          <Text style={styles.statN}>{home?.children_count ?? "—"}</Text>
          <Text style={styles.statL}>Enfants</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statN}>{home?.pending_convocations ?? "—"}</Text>
          <Text style={styles.statL}>Convocations</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statN}>{home?.unpaid_installments ?? "—"}</Text>
          <Text style={styles.statL}>Impayés</Text>
        </View>
      </View>

      {isParent && (
        <>
          <Text style={styles.section}>Mes enfants / أبنائي</Text>
          {(home?.children || []).map((c) => {
            const photo = mediaUrl(c.photo_path);
            return (
              <View key={c.id} style={styles.childCard}>
                {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={styles.avatarPh}><Text>?</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.full_name}</Text>
                  <Text style={styles.muted}>
                    {c.category_code || "—"} · #{c.legacy_number ?? c.id} · {c.status}
                  </Text>
                  {!!c.blood_type && <Text style={styles.muted}>Groupe sanguin : {c.blood_type}</Text>}
                </View>
              </View>
            );
          })}
          {!home?.children?.length && <Text style={styles.muted}>Aucun enfant lié — contactez le club</Text>}
        </>
      )}

      <Text style={styles.section}>Planning (30 jours) / برنامج الشهر</Text>
      {(home?.upcoming_events || []).map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.cardTitle}>{e.title}</Text>
          <Text style={styles.muted}>
            {e.event_type} · {new Date(e.starts_at).toLocaleString()}
          </Text>
          {!!e.location && <Text style={styles.muted}>{e.location}</Text>}
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
  childCard: { backgroundColor: "white", borderRadius: 14, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 12 },
  avatarPh: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#dbe3f5", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontWeight: "700", color: "#0f1f4d" },
  wake: { marginVertical: 16, alignItems: "center" },
  wakeText: { color: "#1E3A8A", fontWeight: "700" },
});
