import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtDate, statusColor, statusLabel } from "../../src/theme";

type EventRow = {
  id: number;
  title: string;
  title_ar?: string;
  description?: string;
  event_type: string;
  starts_at: string;
  ends_at?: string;
  opponent?: string;
  home_away?: string;
  team_id?: number;
  is_cancelled?: boolean;
  coach_name?: string;
  substitute_coach_name?: string;
};
type Team = { id: number; name: string; category_code?: string; code?: string };
type Conv = {
  id: number;
  event_id: number;
  athlete_id: number;
  status: string;
  athlete_name?: string;
  event_title?: string;
  event_starts_at?: string;
  event_type?: string;
};
type Roster = { athlete_id: number; full_name: string; attendance_status?: string };

function tomorrowLocalParts() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  d.setHours(17);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: "17:00" };
}

export default function AgendaScreen() {
  const { role } = useAuth();
  const isCoach = role === "coach" || role === "admin" || role === "staff" || role === "direction";
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const init = tomorrowLocalParts();
  const [form, setForm] = useState({
    event_type: "training",
    title: "Entraînement",
    title_ar: "تدريب",
    team_id: 0,
    date: init.date,
    time: init.time,
    opponent: "",
    home_away: "home",
    description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [e, c] = await Promise.all([
        api<EventRow[]>("/api/v1/events?include_cancelled=true&limit=100"),
        api<Conv[]>("/api/v1/convocations").catch(() => [] as Conv[]),
      ]);
      setEvents(e);
      setConvs(c);
      if (isCoach) {
        const tms = await api<Team[]>("/api/v1/teams/coaches").catch(async () => {
          const plain = await api<{ id: number; name: string; code?: string }[]>("/api/v1/teams").catch(() => []);
          return plain.map((t) => ({ ...t, category_code: t.code }));
        });
        setTeams(tms);
        setForm((f) => (f.team_id || !tms[0] ? f : { ...f, team_id: tms[0].id }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur chargement agenda");
    } finally {
      setLoading(false);
    }
  }, [isCoach]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pendingConvs = useMemo(() => convs.filter((c) => c.status === "pending"), [convs]);
  const upcoming = useMemo(
    () =>
      [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  async function respond(id: number, status: "confirmed" | "declined" | "excused") {
    try {
      await api(`/api/v1/convocations/${id}/respond?status=${status}`, { method: "POST" });
      setMsg(status === "confirmed" ? "Présence confirmée" : "Réponse enregistrée");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function openSession(ev: EventRow) {
    setSelected(ev);
    setMsg("");
    setErr("");
    setShowCreate(false);
    if (!isCoach || ev.is_cancelled) {
      setRoster([]);
      return;
    }
    try {
      setRoster(await api<Roster[]>(`/api/v1/events/${ev.id}/roster`));
    } catch {
      setRoster([]);
    }
  }

  async function setAtt(athleteId: number, status: string) {
    if (!selected) return;
    await api(`/api/v1/events/${selected.id}/attendance`, {
      method: "POST",
      body: JSON.stringify([{ athlete_id: athleteId, status }]),
    });
    setRoster((rows) =>
      rows.map((r) => (r.athlete_id === athleteId ? { ...r, attendance_status: status } : r)),
    );
  }

  async function inviteAll() {
    if (!selected || !roster.length) return;
    setSaving(true);
    try {
      await api(`/api/v1/events/${selected.id}/convocations`, {
        method: "POST",
        body: JSON.stringify(roster.map((r) => r.athlete_id)),
      });
      setMsg("Convocations envoyées aux joueurs de l’équipe");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur convocations");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/api/v1/events/${selected.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "Séance annulée", notify: true }),
      });
      setMsg("Séance annulée — parents notifiés");
      setSelected(null);
      setReason("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur annulation");
    } finally {
      setSaving(false);
    }
  }

  async function createEvent() {
    if (!form.title.trim() || !form.date || !form.time) {
      setErr("Titre, date et heure requis");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const starts = new Date(`${form.date}T${form.time}:00`);
      if (Number.isNaN(starts.getTime())) throw new Error("Date/heure invalides (AAAA-MM-JJ et HH:MM)");
      const created = await api<EventRow>("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({
          event_type: form.event_type,
          title: form.title.trim(),
          title_ar: form.title_ar.trim() || null,
          description: form.description.trim() || null,
          starts_at: starts.toISOString(),
          team_id: form.team_id || null,
          opponent: form.event_type === "match" ? form.opponent || null : null,
          home_away: form.event_type === "match" ? form.home_away : null,
        }),
      });
      setMsg("Séance créée");
      setShowCreate(false);
      setSelected(created);
      if (isCoach) {
        try {
          setRoster(await api<Roster[]>(`/api/v1/events/${created.id}/roster`));
        } catch {
          setRoster([]);
        }
      }
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.okMsg}>{msg}</Text>}

      {!isCoach && (
        <View style={styles.block}>
          <Text style={styles.section}>Convocations / الاستدعاءات</Text>
          {pendingConvs.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.title}>{c.event_title || `Événement #${c.event_id}`}</Text>
              <Text style={styles.muted}>
                {c.athlete_name || `Joueur #${c.athlete_id}`}
                {c.event_type ? ` · ${statusLabel(c.event_type)}` : ""}
              </Text>
              <Text style={styles.muted}>{fmtDate(c.event_starts_at)}</Text>
              <View style={styles.rowBtns}>
                <Pressable style={styles.ok} onPress={() => respond(c.id, "confirmed")}>
                  <Text style={styles.okT}>Confirmer</Text>
                </Pressable>
                <Pressable style={styles.no} onPress={() => respond(c.id, "declined")}>
                  <Text style={styles.noT}>Décliner</Text>
                </Pressable>
                <Pressable style={styles.late} onPress={() => respond(c.id, "excused")}>
                  <Text style={styles.lateT}>Excusé</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!pendingConvs.length && <Text style={styles.muted}>Aucune convocation en attente</Text>}
        </View>
      )}

      {isCoach && (
        <View style={styles.block}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setShowCreate((v) => !v);
              setSelected(null);
              setMsg("");
            }}
          >
            <Text style={styles.okT}>{showCreate ? "Fermer le formulaire" : "+ Nouvelle séance"}</Text>
          </Pressable>

          {showCreate && (
            <View style={styles.card}>
              <Text style={styles.section}>Créer une séance</Text>
              <Text style={styles.label}>Type</Text>
              <View style={styles.chips}>
                {[
                  { id: "training", label: "Entraînement" },
                  { id: "match", label: "Match" },
                  { id: "meeting", label: "Réunion" },
                  { id: "other", label: "Autre" },
                ].map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.chip, form.event_type === t.id && styles.chipOn]}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        event_type: t.id,
                        title: t.id === "training" ? "Entraînement" : t.id === "match" ? "Match" : f.title,
                        title_ar: t.id === "training" ? "تدريب" : t.id === "match" ? "مباراة" : f.title_ar,
                      }))
                    }
                  >
                    <Text style={[styles.chipText, form.event_type === t.id && styles.chipTextOn]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Titre</Text>
              <TextInput style={styles.input} value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} />
              <Text style={styles.label}>Titre AR</Text>
              <TextInput style={styles.input} value={form.title_ar} onChangeText={(t) => setForm((f) => ({ ...f, title_ar: t }))} />

              <Text style={styles.label}>Équipe</Text>
              <View style={styles.chips}>
                {teams.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.chip, form.team_id === t.id && styles.chipOn]}
                    onPress={() => setForm((f) => ({ ...f, team_id: t.id }))}
                  >
                    <Text style={[styles.chipText, form.team_id === t.id && styles.chipTextOn]}>
                      {t.name}
                      {t.category_code ? ` (${t.category_code})` : ""}
                    </Text>
                  </Pressable>
                ))}
                {!teams.length && <Text style={styles.muted}>Aucune équipe</Text>}
              </View>

              <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-08-01"
                value={form.date}
                onChangeText={(t) => setForm((f) => ({ ...f, date: t }))}
                autoCapitalize="none"
              />
              <Text style={styles.label}>Heure (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="17:00"
                value={form.time}
                onChangeText={(t) => setForm((f) => ({ ...f, time: t }))}
                autoCapitalize="none"
              />

              {form.event_type === "match" && (
                <>
                  <Text style={styles.label}>Adversaire</Text>
                  <TextInput
                    style={styles.input}
                    value={form.opponent}
                    onChangeText={(t) => setForm((f) => ({ ...f, opponent: t }))}
                  />
                  <View style={styles.chips}>
                    {[
                      { id: "home", label: "Domicile" },
                      { id: "away", label: "Extérieur" },
                    ].map((h) => (
                      <Pressable
                        key={h.id}
                        style={[styles.chip, form.home_away === h.id && styles.chipOn]}
                        onPress={() => setForm((f) => ({ ...f, home_away: h.id }))}
                      >
                        <Text style={[styles.chipText, form.home_away === h.id && styles.chipTextOn]}>{h.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
                multiline
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              />

              <Pressable style={styles.primaryBtn} onPress={createEvent} disabled={saving}>
                <Text style={styles.okT}>{saving ? "Enregistrement…" : "Créer la séance"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Text style={styles.section}>Séances / الحصص</Text>
      {upcoming.map((e) => (
        <Pressable
          key={e.id}
          style={[styles.session, e.is_cancelled && styles.cancelled, selected?.id === e.id && styles.selected]}
          onPress={() => openSession(e)}
        >
          <View style={styles.sessionTop}>
            <Text style={styles.sessionType}>{statusLabel(e.event_type)}</Text>
            {e.is_cancelled && <Text style={styles.badgeCancel}>ANNULÉ</Text>}
          </View>
          <Text style={styles.sessionTitle}>{e.title}</Text>
          {!!e.title_ar && <Text style={styles.sessionAr}>{e.title_ar}</Text>}
          <Text style={styles.sessionMeta}>{fmtDate(e.starts_at)}</Text>
          {!!e.opponent && (
            <Text style={styles.sessionMeta}>
              vs {e.opponent}
              {e.home_away ? ` · ${e.home_away === "home" ? "Domicile" : "Extérieur"}` : ""}
            </Text>
          )}
          {!!e.coach_name && <Text style={styles.sessionMeta}>Coach : {e.coach_name}</Text>}
        </Pressable>
      ))}
      {!upcoming.length && !loading && <Text style={styles.muted}>Aucune séance planifiée</Text>}

      {selected && (
        <View style={styles.card}>
          <Text style={styles.section}>Détail — {selected.title}</Text>
          <Text style={styles.muted}>{statusLabel(selected.event_type)} · {fmtDate(selected.starts_at)}</Text>
          {!!selected.description && <Text style={styles.body}>{selected.description}</Text>}
          {!!selected.coach_name && <Text style={styles.muted}>Coach : {selected.coach_name}</Text>}
          {!!selected.substitute_coach_name && (
            <Text style={styles.muted}>Remplaçant : {selected.substitute_coach_name}</Text>
          )}

          {isCoach && !selected.is_cancelled && (
            <>
              <View style={styles.rowBtns}>
                <Pressable style={styles.ok} onPress={inviteAll} disabled={saving || !roster.length}>
                  <Text style={styles.okT}>Convoquer l’équipe</Text>
                </Pressable>
              </View>

              <Text style={[styles.section, { marginTop: 12 }]}>Présences ({roster.length})</Text>
              {roster.map((r) => (
                <View key={r.athlete_id} style={styles.rosterRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.full_name}</Text>
                    <Text style={{ color: statusColor(r.attendance_status || ""), fontWeight: "700" }}>
                      {r.attendance_status ? statusLabel(r.attendance_status) : "Non marqué"}
                    </Text>
                  </View>
                  <View style={styles.rowBtns}>
                    <Pressable style={styles.ok} onPress={() => setAtt(r.athlete_id, "present")}>
                      <Text style={styles.okT}>P</Text>
                    </Pressable>
                    <Pressable style={styles.no} onPress={() => setAtt(r.athlete_id, "absent")}>
                      <Text style={styles.noT}>A</Text>
                    </Pressable>
                    <Pressable style={styles.late} onPress={() => setAtt(r.athlete_id, "late")}>
                      <Text style={styles.lateT}>R</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {!roster.length && <Text style={styles.muted}>Aucun joueur dans l’effectif de l’équipe</Text>}

              <Text style={styles.label}>Annuler la séance</Text>
              <TextInput
                style={styles.input}
                placeholder="Motif annulation / سبب الإلغاء"
                value={reason}
                onChangeText={setReason}
              />
              <Pressable style={styles.danger} onPress={cancelSession} disabled={saving}>
                <Text style={styles.okT}>Annuler + notifier les parents</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  block: { gap: 10 },
  section: { fontWeight: "800", color: colors.blue, fontSize: 17, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 6 },
  title: { fontWeight: "700", color: colors.navy, fontSize: 15 },
  muted: { color: colors.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
  body: { color: colors.navy, marginTop: 6, lineHeight: 20 },
  session: { backgroundColor: colors.blue, borderRadius: 16, padding: 14, gap: 4 },
  cancelled: { opacity: 0.55 },
  selected: { borderWidth: 2, borderColor: colors.gold },
  sessionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionType: { color: colors.gold, fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  badgeCancel: { color: "#fecaca", fontWeight: "800", fontSize: 11 },
  sessionTitle: { color: "white", fontWeight: "800", fontSize: 17 },
  sessionAr: { color: "rgba(255,255,255,0.85)" },
  sessionMeta: { color: "rgba(255,255,255,0.8)", marginTop: 2, fontSize: 13 },
  rosterRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f7",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  ok: { backgroundColor: colors.blue, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  okT: { color: "white", fontWeight: "700" },
  no: { backgroundColor: colors.softRed, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  noT: { color: "#a33", fontWeight: "700" },
  late: { backgroundColor: colors.softGold, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  lateT: { color: "#7a5b00", fontWeight: "700" },
  label: { marginTop: 10, fontWeight: "700", color: "#334155", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.softGray,
    marginTop: 4,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  danger: { backgroundColor: colors.danger, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  okMsg: { color: colors.success, fontWeight: "700", textAlign: "center" },
  err: { color: colors.danger, fontWeight: "700", textAlign: "center" },
});
