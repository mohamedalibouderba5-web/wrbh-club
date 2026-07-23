import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";

type Ann = { id: number; title: string; title_ar?: string; body: string };
type Thread = { id: number; subject: string; status: string };

export default function MessagesScreen() {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        api<Ann[]>("/api/v1/announcements"),
        api<Thread[]>("/api/v1/threads"),
      ]).then(([a, t]) => {
        setAnns(a);
        setThreads(t);
      });
    }, []),
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={styles.section}>Annonces club</Text>
      {anns.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.title}>{a.title}</Text>
          {!!a.title_ar && <Text style={styles.ar}>{a.title_ar}</Text>}
          <Text style={styles.muted}>{a.body}</Text>
        </View>
      ))}
      <Text style={styles.section}>Messages</Text>
      {threads.map((t) => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.title}>{t.subject}</Text>
          <Text style={styles.muted}>{t.status}</Text>
        </View>
      ))}
      {!threads.length && <Text style={styles.muted}>Aucun fil pour le moment.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  section: { fontWeight: "800", color: "#1E3A8A", fontSize: 16 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  title: { fontWeight: "700" },
  ar: { color: "#5b6478" },
  muted: { color: "#5b6478", marginTop: 4 },
});
