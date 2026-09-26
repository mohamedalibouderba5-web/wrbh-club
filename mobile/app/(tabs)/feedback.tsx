import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { colors } from "../../src/theme";

const TARGETS = [
  { id: "athletes", fr: "Athlètes", ar: "اللاعبون" },
  { id: "registrations", fr: "Inscriptions", ar: "التسجيلات" },
  { id: "teams", fr: "Équipes / Coachs", ar: "الفرق / المدربون" },
  { id: "finance", fr: "Finance", ar: "المالية" },
  { id: "inventory", fr: "Matériel", ar: "المعدات" },
  { id: "agenda", fr: "Agenda", ar: "الجدول" },
  { id: "photos", fr: "Photos / capture", ar: "الصور" },
  { id: "other", fr: "Autre", ar: "أخرى" },
];

export default function FeedbackScreen() {
  const [target, setTarget] = useState("athletes");
  const [reportType, setReportType] = useState<"bug" | "idea" | "other">("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const selected = useMemo(() => TARGETS.find((t) => t.id === target), [target]);

  async function submit() {
    if (message.trim().length < 3) {
      setErr("Message trop court");
      return;
    }
    setBusy(true);
    setErr("");
    setDone("");
    try {
      await api("/api/v1/feedback/report", {
        method: "POST",
        body: JSON.stringify({
          target,
          target_label: selected?.fr,
          report_type: reportType,
          message: message.trim(),
          page_url: `mobile://feedback/${target}`,
          meta: { platform: "mobile", path: target },
        }),
      });
      setDone("Feedback envoyé — merci");
      setMessage("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Text style={styles.h}>Feedback / ملاحظات</Text>
      <Text style={styles.muted}>Signalez un bug ou une idée pour chaque écran / fonction.</Text>

      <Text style={styles.label}>Écran / tâche</Text>
      <View style={styles.chips}>
        {TARGETS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.chip, target === t.id && styles.chipOn]}
            onPress={() => setTarget(t.id)}
          >
            <Text style={[styles.chipText, target === t.id && styles.chipTextOn]}>{t.fr}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {(
          [
            ["bug", "Bug"],
            ["idea", "Idée"],
            ["other", "Autre"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.chip, reportType === id && styles.chipOn]}
            onPress={() => setReportType(id)}
          >
            <Text style={[styles.chipText, reportType === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Message</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={5}
        placeholder="Décrivez le problème ou l’idée…"
        value={message}
        onChangeText={setMessage}
        textAlignVertical="top"
      />

      {err ? <Text style={styles.err}>{err}</Text> : null}
      {done ? <Text style={styles.ok}>{done}</Text> : null}

      <Pressable style={styles.btn} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Envoyer</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f1f5f9" },
  h: { fontSize: 22, fontWeight: "700", color: colors.blue },
  muted: { color: "#64748b", marginBottom: 8 },
  label: { fontWeight: "600", color: "#0f172a", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: "#334155", fontSize: 13 },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    minHeight: 120,
    color: "#0f172a",
  },
  btn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  err: { color: "#dc2626" },
  ok: { color: "#16a34a" },
});
