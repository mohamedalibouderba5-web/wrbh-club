import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";

type EventRow = {
  id: number;
  title: string;
  title_ar?: string;
  event_type: string;
  starts_at: string;
  opponent?: string;
  is_cancelled?: boolean;
};
type Conv = { id: number; event_id: number; athlete_id: number; status: string };
type Roster = { athlete_id: number; full_name: string; attendance_status?: string };

export default function AgendaScreen() {
  const { role } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const isCoach = role === "coach" || role === "admin" || role === "staff" || role === "direction";

  const load = useCallback(async () => {
    const [e, c] = await Promise.all([
      api<EventRow[]>("/api/v1/events?include_cancelled=true"),
      api<Conv[]>("/api/v1/convocations").catch(() => []),
    ]);
    setEvents(e);
    setConvs(c.filter((x) => x.status === "pending"));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(id: number, status: "confirmed" | "declined") {
    await api(`/api/v1/convocations/${id}/respond?status=${status}`, { method: "POST" });
    load();
  }

  async function openSession(ev: EventRow) {
    setSelected(ev);
    setMsg("");
    if (!isCoach || ev.is_cancelled) {
      setRoster([]);
      return;
    }
    const rows = await api<Roster[]>(`/api/v1/events/${ev.id}/roster`);
    setRoster(rows);
  }

  async function setAtt(athleteId: number, status: string) {
    if (!selected) return;
    await api(`/api/v1/events/${selected.id}/attendance`, {
      method: "POST",
      body: JSON.stringify([{ athlete_id: athleteId, status }]),
    });
    setRoster((rows) => rows.map((r) => (r.athlete_id === athleteId ? { ...r, attendance_status: status } : r)));
  }

  async function cancelSession() {
    if (!selected) return;
    await api(`/api/v1/events/${selected.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "Séance annulée", notify: true }),
    });
    setMsg("Annulé + parents notifiés / تم إشعار الأولياء");
    setSelected(null);
    load();
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 10 }}>
      {!isCoach && (
        <>
          <Text style={styles.section}>Convocations / الاستدعاءات</Text>
          {convs.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.title}>Convocation #{c.id}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable style={styles.ok} onPress={() => respond(c.id, "confirmed")}>
                  <Text style={styles.okT}>Confirmer</Text>
                </Pressable>
                <Pressable style={styles.no} onPress={() => respond(c.id, "declined")}>
                  <Text style={styles.noT}>Décliner</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!convs.length && <Text style={styles.muted}>Aucune convocation</Text>}
        </>
      )}

      <Text style={styles.section}>Séances / الحصص</Text>
      {events.map((e) => (
        <Pressable
          key={e.id}
          style={[styles.session, e.is_cancelled && styles.cancelled, selected?.id === e.id && styles.selected]}
          onPress={() => openSession(e)}
        >
          <Text style={styles.sessionTitle}>{e.title}</Text>
          {!!e.title_ar && <Text style={styles.ar}>{e.title_ar}</Text>}
          <Text style={styles.sessionMeta}>
            {e.is_cancelled ? "ANNULÉ · " : ""}
            {e.event_type} · {new Date(e.starts_at).toLocaleString()}
          </Text>
        </Pressable>
      ))}

      {selected && isCoach && !selected.is_cancelled && (
        <View style={styles.card}>
          <Text style={styles.section}>Présences — {selected.title}</Text>
          {roster.map((r) => (
            <View key={r.athlete_id} style={styles.rosterRow}>
              <Text style={styles.title}>{r.full_name}</Text>
              <Text style={styles.muted}>{r.attendance_status || "—"}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <Pressable style={styles.ok} onPress={() => setAtt(r.athlete_id, "present")}>
                  <Text style={styles.okT}>Présent</Text>
                </Pressable>
                <Pressable style={styles.no} onPress={() => setAtt(r.athlete_id, "absent")}>
                  <Text style={styles.noT}>Absent</Text>
                </Pressable>
                <Pressable style={styles.late} onPress={() => setAtt(r.athlete_id, "late")}>
                  <Text style={styles.lateT}>Retard</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <TextInput
            style={styles.input}
            placeholder="Motif annulation / سبب الإلغاء"
            value={reason}
            onChangeText={setReason}
          />
          <Pressable style={styles.danger} onPress={cancelSession}>
            <Text style={styles.okT}>Annuler séance + notifier</Text>
          </Pressable>
        </View>
      )}
      {!!msg && <Text style={styles.okMsg}>{msg}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  section: { fontWeight: "800", color: "#1E3A8A", fontSize: 16, marginTop: 6 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12 },
  title: { fontWeight: "700", color: "#0f1f4d" },
  muted: { color: "#5b6478", marginTop: 2 },
  ar: { color: "#5b6478", marginTop: 2 },
  session: {
    backgroundColor: "#1E3A8A",
    borderRadius: 16,
    padding: 14,
  },
  cancelled: { opacity: 0.55 },
  selected: { borderWidth: 2, borderColor: "#F5C518" },
  sessionTitle: { color: "white", fontWeight: "800", fontSize: 16 },
  sessionMeta: { color: "rgba(255,255,255,0.8)", marginTop: 4 },
  rosterRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#edf0f7" },
  ok: { backgroundColor: "#1E3A8A", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  okT: { color: "white", fontWeight: "700" },
  no: { backgroundColor: "#fde8e8", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  noT: { color: "#a33", fontWeight: "700" },
  late: { backgroundColor: "#fff3c4", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  lateT: { color: "#7a5b00", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d7deee",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  danger: { backgroundColor: "#dc2626", padding: 12, borderRadius: 10, alignItems: "center" },
  okMsg: { color: "#166534", fontWeight: "700", textAlign: "center" },
});
