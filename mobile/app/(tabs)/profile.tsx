import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";

type Child = { id: number; full_name: string; birth_date?: string; status: string; legacy_number?: number };

export default function ProfileScreen() {
  const { fullName, role, logout } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);

  useFocusEffect(
    useCallback(() => {
      api<Child[]>("/api/v1/mobile/children").then(setChildren).catch(() => setChildren([]));
    }, []),
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={styles.card}>
        <Text style={styles.title}>{fullName}</Text>
        <Text style={styles.muted}>Rôle : {role}</Text>
      </View>

      <Text style={styles.section}>Mes enfants / أبنائي</Text>
      {children.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.title}>{c.full_name}</Text>
          <Text style={styles.muted}>#{c.legacy_number ?? c.id} · {c.birth_date ?? "—"} · {c.status}</Text>
        </View>
      ))}
      {!children.length && role === "parent" && <Text style={styles.muted}>Aucun enfant lié</Text>}
      {role === "coach" && (
        <View style={styles.card}>
          <Text style={styles.title}>Mode coach</Text>
          <Text style={styles.muted}>Agenda = convocations. Présences via POST /api/v1/events/{"{id}"}/attendance</Text>
        </View>
      )}

      <Pressable style={styles.logout} onPress={() => logout()}>
        <Text style={styles.logoutT}>Déconnexion</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  section: { fontWeight: "800", color: "#1E3A8A" },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  title: { fontWeight: "800", color: "#0f1f4d" },
  muted: { color: "#5b6478", marginTop: 4 },
  logout: { backgroundColor: "#1E3A8A", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  logoutT: { color: "white", fontWeight: "800" },
});
