import { useCallback, useState } from "react";
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
import { colors, fmtDate, statusLabel } from "../../src/theme";

type Ann = {
  id: number;
  title: string;
  title_ar?: string;
  body: string;
  body_ar?: string;
  audience?: string;
  is_pinned?: boolean;
  published_at?: string;
};
type Thread = {
  id: number;
  subject: string;
  status: string;
  athlete_id?: number;
  created_by_name?: string;
  last_message?: string;
  updated_at?: string;
};
type Notif = {
  id: number;
  title: string;
  body: string;
  kind?: string;
  is_read: boolean;
  created_at?: string;
};
type ThreadDetail = {
  id: number;
  subject: string;
  status: string;
  messages: {
    id: number;
    sender_id: number;
    sender_name?: string;
    body: string;
    created_at?: string;
    is_mine?: boolean;
  }[];
};
type Child = { id: number; full_name: string };

export default function MessagesScreen() {
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "direction" || role === "staff";
  const isParent = role === "parent";
  const [tab, setTab] = useState<"announcements" | "threads" | "notifications">("announcements");
  const [anns, setAnns] = useState<Ann[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [openAnn, setOpenAnn] = useState<number | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [compose, setCompose] = useState({ subject: "", body: "", athlete_id: 0 });
  const [annForm, setAnnForm] = useState({
    title: "",
    title_ar: "",
    body: "",
    body_ar: "",
    audience: "all",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [a, t, n] = await Promise.all([
        api<Ann[]>("/api/v1/announcements").catch(() => [] as Ann[]),
        api<Thread[]>("/api/v1/threads").catch(() => [] as Thread[]),
        api<Notif[]>("/api/v1/notifications").catch(() => [] as Notif[]),
      ]);
      setAnns(a);
      setThreads(t);
      setNotifs(n);
      if (isParent) {
        const kids = await api<Child[]>("/api/v1/mobile/children").catch(() => [] as Child[]);
        setChildren(kids);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur messages");
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function openThread(id: number) {
    setErr("");
    try {
      const d = await api<ThreadDetail>(`/api/v1/threads/${id}`);
      setDetail(d);
      setReply("");
      setShowCompose(false);
      setTab("threads");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Impossible d’ouvrir le fil");
    }
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    setSaving(true);
    try {
      const m = await api<ThreadDetail["messages"][0]>(`/api/v1/threads/${detail.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      setDetail({ ...detail, messages: [...detail.messages, m] });
      setReply("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur envoi");
    } finally {
      setSaving(false);
    }
  }

  async function createThread() {
    if (!compose.subject.trim() || !compose.body.trim()) {
      setErr("Sujet et message requis");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const created = await api<{ id: number }>("/api/v1/threads", {
        method: "POST",
        body: JSON.stringify({
          subject: compose.subject.trim(),
          body: compose.body.trim(),
          athlete_id: compose.athlete_id || null,
        }),
      });
      setCompose({ subject: "", body: "", athlete_id: 0 });
      setShowCompose(false);
      setMsg("Message envoyé au club");
      await load();
      openThread(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setSaving(false);
    }
  }

  async function createAnnouncement() {
    if (!annForm.title.trim() || !annForm.body.trim()) {
      setErr("Titre et contenu requis");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api("/api/v1/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: annForm.title.trim(),
          title_ar: annForm.title_ar.trim() || null,
          body: annForm.body.trim(),
          body_ar: annForm.body_ar.trim() || null,
          audience: annForm.audience,
          is_pinned: false,
        }),
      });
      setAnnForm({ title: "", title_ar: "", body: "", body_ar: "", audience: "all" });
      setShowAnnForm(false);
      setMsg("Annonce publiée");
      setTab("announcements");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur publication");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={styles.tabs}>
        {(
          [
            ["announcements", "Annonces"],
            ["threads", "Messages"],
            ["notifications", "Notifs"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      {tab === "announcements" && (
        <>
          {isStaff && (
            <Pressable style={styles.primaryBtn} onPress={() => setShowAnnForm((v) => !v)}>
              <Text style={styles.primaryBtnT}>{showAnnForm ? "Fermer" : "+ Publier une annonce"}</Text>
            </Pressable>
          )}
          {showAnnForm && (
            <View style={styles.card}>
              <Text style={styles.section}>Nouvelle annonce</Text>
              <TextInput
                style={styles.input}
                placeholder="Titre"
                value={annForm.title}
                onChangeText={(t) => setAnnForm((f) => ({ ...f, title: t }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Titre AR"
                value={annForm.title_ar}
                onChangeText={(t) => setAnnForm((f) => ({ ...f, title_ar: t }))}
              />
              <TextInput
                style={[styles.input, styles.area]}
                multiline
                placeholder="Message"
                value={annForm.body}
                onChangeText={(t) => setAnnForm((f) => ({ ...f, body: t }))}
              />
              <View style={styles.chips}>
                {[
                  { id: "all", label: "Tous" },
                  { id: "parents", label: "Parents" },
                  { id: "coaches", label: "Coachs" },
                  { id: "staff", label: "Staff" },
                ].map((a) => (
                  <Pressable
                    key={a.id}
                    style={[styles.chip, annForm.audience === a.id && styles.chipOn]}
                    onPress={() => setAnnForm((f) => ({ ...f, audience: a.id }))}
                  >
                    <Text style={[styles.chipText, annForm.audience === a.id && styles.chipTextOn]}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.primaryBtn} onPress={createAnnouncement} disabled={saving}>
                <Text style={styles.primaryBtnT}>{saving ? "…" : "Publier"}</Text>
              </Pressable>
            </View>
          )}

          {anns.map((a) => {
            const open = openAnn === a.id;
            return (
              <Pressable key={a.id} style={styles.card} onPress={() => setOpenAnn(open ? null : a.id)}>
                <View style={styles.cardHead}>
                  <Text style={styles.title}>{a.title}</Text>
                  {!!a.is_pinned && <Text style={styles.pin}>Épinglé</Text>}
                </View>
                {!!a.title_ar && <Text style={styles.ar}>{a.title_ar}</Text>}
                <Text style={styles.muted} numberOfLines={open ? undefined : 2}>
                  {a.body}
                </Text>
                {open && !!a.body_ar && <Text style={styles.ar}>{a.body_ar}</Text>}
                <Text style={styles.meta}>
                  {a.audience ? statusLabel(a.audience) : "all"}
                  {a.published_at ? ` · ${fmtDate(a.published_at)}` : ""}
                  {open ? " · toucher pour réduire" : " · toucher pour lire"}
                </Text>
              </Pressable>
            );
          })}
          {!anns.length && !loading && <Text style={styles.muted}>Aucune annonce</Text>}
        </>
      )}

      {tab === "threads" && (
        <>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setDetail(null);
              setShowCompose((v) => !v);
            }}
          >
            <Text style={styles.primaryBtnT}>{showCompose ? "Fermer" : "+ Nouveau message au club"}</Text>
          </Pressable>

          {showCompose && (
            <View style={styles.card}>
              <Text style={styles.section}>Écrire au club</Text>
              {isParent && children.length > 0 && (
                <>
                  <Text style={styles.label}>Concernant</Text>
                  <View style={styles.chips}>
                    <Pressable
                      style={[styles.chip, compose.athlete_id === 0 && styles.chipOn]}
                      onPress={() => setCompose((c) => ({ ...c, athlete_id: 0 }))}
                    >
                      <Text style={[styles.chipText, compose.athlete_id === 0 && styles.chipTextOn]}>Général</Text>
                    </Pressable>
                    {children.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.chip, compose.athlete_id === c.id && styles.chipOn]}
                        onPress={() => setCompose((x) => ({ ...x, athlete_id: c.id }))}
                      >
                        <Text style={[styles.chipText, compose.athlete_id === c.id && styles.chipTextOn]}>
                          {c.full_name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <TextInput
                style={styles.input}
                placeholder="Sujet"
                value={compose.subject}
                onChangeText={(t) => setCompose((c) => ({ ...c, subject: t }))}
              />
              <TextInput
                style={[styles.input, styles.area]}
                multiline
                placeholder="Votre message…"
                value={compose.body}
                onChangeText={(t) => setCompose((c) => ({ ...c, body: t }))}
              />
              <Pressable style={styles.primaryBtn} onPress={createThread} disabled={saving}>
                <Text style={styles.primaryBtnT}>{saving ? "…" : "Envoyer"}</Text>
              </Pressable>
            </View>
          )}

          {detail && (
            <View style={styles.card}>
              <Pressable onPress={() => setDetail(null)}>
                <Text style={styles.back}>← Retour à la liste</Text>
              </Pressable>
              <Text style={styles.section}>{detail.subject}</Text>
              <Text style={styles.meta}>{statusLabel(detail.status)}</Text>
              {detail.messages.map((m) => (
                <View key={m.id} style={[styles.bubble, m.is_mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={styles.bubbleAuthor}>{m.is_mine ? "Moi" : m.sender_name || "Club"}</Text>
                  <Text style={styles.bubbleBody}>{m.body}</Text>
                  <Text style={styles.bubbleTime}>{fmtDate(m.created_at)}</Text>
                </View>
              ))}
              <TextInput
                style={[styles.input, styles.area]}
                multiline
                placeholder="Répondre…"
                value={reply}
                onChangeText={setReply}
              />
              <Pressable style={styles.primaryBtn} onPress={sendReply} disabled={saving || !reply.trim()}>
                <Text style={styles.primaryBtnT}>{saving ? "…" : "Envoyer la réponse"}</Text>
              </Pressable>
            </View>
          )}

          {!detail &&
            threads.map((t) => (
              <Pressable key={t.id} style={styles.card} onPress={() => openThread(t.id)}>
                <Text style={styles.title}>{t.subject}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {t.last_message || "Ouvrir la conversation"}
                </Text>
                <Text style={styles.meta}>
                  {statusLabel(t.status)}
                  {t.created_by_name ? ` · ${t.created_by_name}` : ""}
                  {t.updated_at ? ` · ${fmtDate(t.updated_at)}` : ""}
                </Text>
              </Pressable>
            ))}
          {!detail && !threads.length && !loading && (
            <Text style={styles.muted}>Aucun message. Touchez « Nouveau message » pour écrire au club.</Text>
          )}
        </>
      )}

      {tab === "notifications" && (
        <>
          {notifs.map((n) => (
            <View key={n.id} style={[styles.card, !n.is_read && styles.unread]}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.muted}>{n.body}</Text>
              <Text style={styles.meta}>
                {n.kind || "info"}
                {n.created_at ? ` · ${fmtDate(n.created_at)}` : ""}
              </Text>
            </View>
          ))}
          {!notifs.length && !loading && <Text style={styles.muted}>Aucune notification</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabText: { fontWeight: "800", color: colors.muted, fontSize: 13 },
  tabTextOn: { color: "white" },
  section: { fontWeight: "800", color: colors.blue, fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15, flex: 1 },
  ar: { color: colors.muted, marginTop: 2 },
  muted: { color: colors.muted, marginTop: 2, lineHeight: 20, fontSize: 14 },
  meta: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  pin: { color: colors.blue, fontWeight: "800", fontSize: 11 },
  unread: { borderWidth: 1, borderColor: colors.gold },
  primaryBtn: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryBtnT: { color: "white", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.softGray,
    marginTop: 8,
    fontSize: 15,
  },
  area: { minHeight: 90, textAlignVertical: "top" },
  label: { marginTop: 8, fontWeight: "700", color: "#334155" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
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
  back: { color: colors.blue, fontWeight: "700", marginBottom: 4 },
  bubble: { borderRadius: 14, padding: 10, marginTop: 8 },
  bubbleMine: { backgroundColor: colors.softBlue, alignSelf: "flex-end", maxWidth: "92%" },
  bubbleOther: { backgroundColor: colors.softGray, alignSelf: "flex-start", maxWidth: "92%" },
  bubbleAuthor: { fontWeight: "800", color: colors.navy, fontSize: 12 },
  bubbleBody: { color: colors.navy, marginTop: 4, lineHeight: 20 },
  bubbleTime: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  ok: { color: "#16a34a", fontWeight: "700", textAlign: "center" },
  err: { color: colors.danger, fontWeight: "700", textAlign: "center" },
});
