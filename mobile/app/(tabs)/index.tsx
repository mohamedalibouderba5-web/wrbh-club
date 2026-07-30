import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, wakeServer } from "../../src/api/client";
import { mediaUrl } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtDate, statusLabel } from "../../src/theme";

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
  upcoming_events: {
    id: number;
    title: string;
    starts_at: string;
    event_type: string;
    location?: string;
    opponent?: string;
  }[];
  announcements: { id: number; title: string; title_ar?: string; body: string }[];
};

export default function HomeScreen() {
  const { fullName, role } = useAuth();
  const [home, setHome] = useState<Home | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setErr("");
    try {
      await wakeServer().catch(() => undefined);
      setHome(await api<Home>("/api/v1/mobile/home"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur accueil");
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
  const isCoach = role === "coach" || role === "admin" || role === "staff" || role === "direction";

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.blue} />}
    >
      <Text style={styles.h1}>Salam, {home?.full_name || fullName}</Text>
      <Text style={styles.ar}>{home?.club_name_ar || "الوداد الرياضي لبلدية حمادي"}</Text>
      <Text style={styles.muted}>
        {home?.club_name || "WRBH Club"} · {statusLabel(role || "") || role}
      </Text>
      {!!err && <Text style={styles.err}>{err}</Text>}

      <View style={styles.row}>
        <Pressable style={styles.stat} onPress={() => router.push(isParent ? "/(tabs)/profile" : "/(tabs)/agenda")}>
          <Text style={styles.statN}>{isParent ? home?.children_count ?? "—" : home?.upcoming_events?.length ?? "—"}</Text>
          <Text style={styles.statL}>{isParent ? "Enfants" : "Séances"}</Text>
        </Pressable>
        <Pressable style={styles.stat} onPress={() => router.push("/(tabs)/agenda")}>
          <Text style={styles.statN}>{home?.pending_convocations ?? "—"}</Text>
          <Text style={styles.statL}>Convocations</Text>
        </Pressable>
        <Pressable style={styles.stat} onPress={() => router.push("/(tabs)/payments")}>
          <Text style={styles.statN}>{home?.unpaid_installments ?? "—"}</Text>
          <Text style={styles.statL}>Impayés</Text>
        </Pressable>
      </View>

      <View style={styles.shortcuts}>
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/agenda")}>
          <Text style={styles.shortcutT}>Agenda</Text>
        </Pressable>
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/payments")}>
          <Text style={styles.shortcutT}>Paiements</Text>
        </Pressable>
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.shortcutT}>Messages</Text>
        </Pressable>
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/more")}>
          <Text style={styles.shortcutT}>Plus</Text>
        </Pressable>
      </View>

      {isCoach && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Espace coach / staff</Text>
          <Text style={styles.muted}>
            Agenda, présences, paiements, athlètes, inscriptions et matériel via l’onglet Plus.
          </Text>
          <View style={[styles.shortcuts, { marginTop: 10 }]}>
            <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/athletes")}>
              <Text style={styles.shortcutT}>Athlètes</Text>
            </Pressable>
            <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/registrations")}>
              <Text style={styles.shortcutT}>Inscriptions</Text>
            </Pressable>
            {(role === "admin" || role === "direction" || role === "staff") && (
              <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/inventory")}>
                <Text style={styles.shortcutT}>Matériel</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isParent && (
        <>
          <Text style={styles.section}>Mes enfants / أبنائي</Text>
          {(home?.children || []).map((c) => {
            const photo = mediaUrl(c.photo_path);
            return (
              <Pressable key={c.id} style={styles.childCard} onPress={() => router.push("/(tabs)/profile")}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPh}>
                    <Text>?</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.full_name}</Text>
                  <Text style={styles.muted}>
                    {c.category_code || "—"} · #{c.legacy_number ?? c.id} · {statusLabel(c.status)}
                  </Text>
                  {!!c.blood_type && <Text style={styles.muted}>Groupe sanguin : {c.blood_type}</Text>}
                </View>
              </Pressable>
            );
          })}
          {!home?.children?.length && <Text style={styles.muted}>Aucun enfant lié — contactez le club</Text>}
        </>
      )}

      <Text style={styles.section}>Planning (30 jours) / برنامج الشهر</Text>
      {(home?.upcoming_events || []).map((e) => (
        <Pressable key={e.id} style={styles.card} onPress={() => router.push("/(tabs)/agenda")}>
          <Text style={styles.badge}>{statusLabel(e.event_type)}</Text>
          <Text style={styles.cardTitle}>{e.title}</Text>
          <Text style={styles.muted}>{fmtDate(e.starts_at)}</Text>
          {!!e.opponent && <Text style={styles.muted}>vs {e.opponent}</Text>}
          {!!e.location && <Text style={styles.muted}>{e.location}</Text>}
        </Pressable>
      ))}
      {!home?.upcoming_events?.length && <Text style={styles.muted}>Aucun événement à venir</Text>}

      <Text style={styles.section}>Annonces</Text>
      {(home?.announcements || []).map((a) => (
        <Pressable key={a.id} style={styles.card} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.cardTitle}>{a.title}</Text>
          {!!a.title_ar && <Text style={styles.ar}>{a.title_ar}</Text>}
          <Text style={styles.muted} numberOfLines={3}>
            {a.body}
          </Text>
        </Pressable>
      ))}
      {!home?.announcements?.length && <Text style={styles.muted}>Aucune annonce récente</Text>}

      <Pressable style={styles.wake} onPress={load}>
        <Text style={styles.wakeText}>Actualiser / Réveiller le serveur</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "800", color: colors.blue },
  ar: { color: colors.muted, textAlign: "left" },
  muted: { color: colors.muted, marginTop: 2, lineHeight: 19 },
  err: { color: colors.danger, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12, alignItems: "center" },
  statN: { fontSize: 20, fontWeight: "800", color: colors.blue },
  statL: { fontSize: 12, color: colors.muted, marginTop: 2, textAlign: "center" },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: {
    flex: 1,
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  shortcutT: { color: "white", fontWeight: "800", fontSize: 13 },
  section: { marginTop: 8, fontWeight: "800", color: colors.navy, fontSize: 16 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12, gap: 4 },
  childCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: { width: 52, height: 52, borderRadius: 12 },
  avatarPh: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#dbe3f5",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontWeight: "700", color: colors.navy, fontSize: 15 },
  badge: { color: colors.blue, fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  wake: { marginVertical: 16, alignItems: "center" },
  wakeText: { color: colors.blue, fontWeight: "700" },
});
