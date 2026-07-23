import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";

type Inst = {
  id: number;
  athlete_id: number;
  label: string;
  label_ar?: string;
  amount: number;
  amount_paid: number;
  status: string;
  due_date?: string;
};

export default function PaymentsScreen() {
  const [rows, setRows] = useState<Inst[]>([]);

  useFocusEffect(
    useCallback(() => {
      api<Inst[]>("/api/v1/installments").then(setRows).catch(() => setRows([]));
    }, []),
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={styles.h}>Cotisations / الاشتراكات</Text>
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.title}>{r.label} {r.label_ar ? `· ${r.label_ar}` : ""}</Text>
          <Text style={styles.muted}>Joueur #{r.athlete_id}</Text>
          <Text style={styles.amount}>{Number(r.amount_paid).toLocaleString()} / {Number(r.amount).toLocaleString()} DZD</Text>
          <Text style={styles.badge}>{r.status}</Text>
        </View>
      ))}
      {!rows.length && <Text style={styles.muted}>Aucune échéance</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  h: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  title: { fontWeight: "700" },
  muted: { color: "#5b6478" },
  amount: { marginTop: 6, color: "#1E3A8A", fontWeight: "800" },
  badge: { marginTop: 4, color: "#5b6478", fontWeight: "700" },
});
