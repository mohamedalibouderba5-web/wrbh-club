import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { APP_VERSION, mediaUrl } from "../../src/config";
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
        <Text style={styles.muted}>Accès limité : enfants liés, planning, convocations, annonces</Text>
      </View>

      <Text style={styles.section}>Mes enfants / أبنائي ({children.length})</Text>
      {children.map((c) => {
        const photo = mediaUrl(c.photo_path);
        return (
          <View key={c.id} style={styles.childCard}>
            {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={styles.avatarPh}><Text>?</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.full_name}</Text>
              <Text style={styles.muted}>
                {c.category_code || "—"} · #{c.legacy_number ?? c.id} · {c.birth_date ?? "—"}
              </Text>
              <Text style={styles.muted}>
                {c.status}
                {c.blood_type ? ` · Sang ${c.blood_type}` : ""}
              </Text>
            </View>
          </View>
        );
      })}
      {!children.length && role === "parent" && (
        <Text style={styles.muted}>Aucun enfant lié. Le club doit enregistrer le téléphone parent à l’inscription.</Text>
      )}
      {role === "coach" && (
        <View style={styles.card}>
          <Text style={styles.title}>Mode coach</Text>
          <Text style={styles.muted}>Agenda = convocations et présences des équipes.</Text>
        </View>
      )}

      <Pressable style={styles.logout} onPress={() => logout()}>
        <Text style={styles.logoutT}>Déconnexion</Text>
      </Pressable>
      <Text style={styles.version}>WRBH Club · version {APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  section: { fontWeight: "800", color: "#1E3A8A" },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  childCard: { backgroundColor: "white", borderRadius: 14, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 12 },
  avatarPh: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#dbe3f5", alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "800", color: "#0f1f4d" },
  muted: { color: "#5b6478", marginTop: 4 },
  logout: { backgroundColor: "#1E3A8A", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  logoutT: { color: "white", fontWeight: "800" },
  version: { color: "#64748b", textAlign: "center", fontSize: 12, marginTop: 4 },
});
