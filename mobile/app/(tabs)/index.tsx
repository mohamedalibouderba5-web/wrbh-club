import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, wakeServer } from "../../src/api/client";
import { mediaUrl } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";
import { useI18n } from "../../src/context/I18nContext";
import {
  fetchUnreadCount,
  notifKindLabel,
  openNotification,
  type NotifRow,
} from "../../src/notifications";
import { colors, fmtDate, fmtMoney, sessionBadge, statusLabel } from "../../src/theme";

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
    location_text?: string;
    opponent?: string;
    session_status?: string;
    is_cancelled?: boolean;
  }[];
  announcements: { id: number; title: string; title_ar?: string; body: string }[];
};

type FinanceDash = {
  cotisations_due: number;
  cotisations_paid: number;
  ledger_income: number;
  ledger_expense: number;
  overdue_count: number;
  /** Échéances due+partial+overdue (aligné onglet Paiements) */
  unpaid_count?: number;
};

export default function HomeScreen() {
  const { fullName, role } = useAuth();
  const { t } = useI18n();
  const [home, setHome] = useState<Home | null>(null);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [finance, setFinance] = useState<FinanceDash | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setErr("");
    try {
      await wakeServer().catch(() => undefined);
      const staff = role === "admin" || role === "direction" || role === "staff";
      const [h, n, count, fin, unpaidMeta] = await Promise.all([
        api<Home>("/api/v1/mobile/home"),
        api<NotifRow[]>("/api/v1/notifications?limit=8").catch(() => [] as NotifRow[]),
        fetchUnreadCount(),
        staff
          ? // Chemin réel = /api/v1/dashboard (pas /finance/dashboard — 404 → 0 fantôme)
            api<FinanceDash>("/api/v1/dashboard").catch(() => null)
          : Promise.resolve(null),
        staff
          ? api<{ total: number; remaining_sum: number }>(
              "/api/v1/installments/meta?status=due,partial,overdue",
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      setHome(h);
      setNotifs(Array.isArray(n) ? n.slice(0, 6) : []);
      setUnread(count);
      // Impayés Accueil = nb échéances due+partial+overdue (aligné onglet Paiements)
      if (fin) {
        setFinance({
          ...fin,
          unpaid_count: fin.unpaid_count ?? unpaidMeta?.total ?? 0,
          cotisations_due:
            Number(fin.cotisations_due) > 0
              ? fin.cotisations_due
              : unpaidMeta?.remaining_sum ?? fin.cotisations_due,
        });
      } else if (unpaidMeta) {
        setFinance({
          cotisations_due: unpaidMeta.remaining_sum,
          cotisations_paid: 0,
          ledger_income: 0,
          ledger_expense: 0,
          overdue_count: 0,
          unpaid_count: unpaidMeta.total,
        });
      } else {
        setFinance(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur accueil");
    } finally {
      setRefreshing(false);
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isParent = role === "parent";
  const isPureCoach = role === "coach";
  const isAdminDir = role === "admin" || role === "direction";
  const isStaffOnly = role === "staff";
  const isStaffOps = isAdminDir || isStaffOnly;
  const spaceTitle = isParent
    ? t("parentSpace")
    : isPureCoach
      ? t("coachSpace")
      : isStaffOps
        ? t("staffSpace")
        : "";
  const spaceHint = isParent
    ? t("parentSpaceHint")
    : isPureCoach
      ? t("coachSpaceHint")
      : "";

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.blue} />}
    >
      <Text style={styles.brand}>Nadi Connect</Text>
      <Text style={styles.h1}>
        {t("hello")}, {home?.full_name || fullName}
      </Text>
      <Text style={styles.ar}>{home?.club_name_ar || "نادي · تسيير ومتابعة النوادي الرياضية في الجزائر"}</Text>
      <Text style={styles.muted}>
        {home?.club_name || "Club"} · {statusLabel(role || "") || role}
        {spaceTitle ? ` · ${spaceTitle}` : ""}
      </Text>
      {!!spaceHint && <Text style={styles.muted}>{spaceHint}</Text>}
      {!!err && <Text style={styles.err}>{err}</Text>}

      <View style={styles.row}>
        <Pressable style={styles.stat} onPress={() => router.push(isParent ? "/(tabs)/profile" : "/(tabs)/agenda")}>
          <Text style={styles.statN}>{isParent ? home?.children_count ?? "—" : home?.upcoming_events?.length ?? "—"}</Text>
          <Text style={styles.statL}>{isParent ? t("children") : t("sessions")}</Text>
        </Pressable>
        <Pressable style={styles.stat} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.statN}>{unread > 0 ? unread : (home?.pending_convocations ?? "—")}</Text>
          <Text style={styles.statL}>{unread > 0 ? t("notifications") : t("convocations")}</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() =>
            router.push(
              isStaffOps
                ? "/(tabs)/payments"
                : isParent
                  ? "/(tabs)/profile"
                  : "/(tabs)/teams",
            )
          }
        >
          <Text style={styles.statN}>
            {isPureCoach
              ? "—"
              : isStaffOps && finance
                ? finance.unpaid_count ?? 0
                : home?.unpaid_installments ?? "—"}
          </Text>
          <Text style={styles.statL}>
            {isParent ? t("toFollow") : isPureCoach ? t("teams") : t("unpaid")}
          </Text>
        </Pressable>
      </View>

      {isAdminDir && finance && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tableau de bord — direction</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{fmtMoney(finance.cotisations_paid)}</Text>
              <Text style={styles.kpiL}>Cotisations encaissées</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{fmtMoney(finance.cotisations_due)}</Text>
              <Text style={styles.kpiL}>Reste à encaisser</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{home?.upcoming_events?.length ?? 0}</Text>
              <Text style={styles.kpiL}>Séances à venir</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{unread}</Text>
              <Text style={styles.kpiL}>Notifs non lues</Text>
            </View>
          </View>
        </View>
      )}

      {isStaffOnly && finance && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tableau de bord — compta</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{fmtMoney(finance.ledger_income)}</Text>
              <Text style={styles.kpiL}>Recettes ledger</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{fmtMoney(finance.ledger_expense)}</Text>
              <Text style={styles.kpiL}>Dépenses</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{fmtMoney(finance.cotisations_due)}</Text>
              <Text style={styles.kpiL}>Échéances dues</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiN}>{finance.overdue_count}</Text>
              <Text style={styles.kpiL}>En retard</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.shortcuts}>
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/agenda")}>
          <Text style={styles.shortcutT}>{t("agenda")}</Text>
        </Pressable>
        {isStaffOps && (
          <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/payments")}>
            <Text style={styles.shortcutT}>{t("payments")}</Text>
          </Pressable>
        )}
        {isPureCoach && (
          <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/teams")}>
            <Text style={styles.shortcutT}>{t("teams")}</Text>
          </Pressable>
        )}
        <Pressable style={styles.shortcut} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.shortcutT}>{t("messages")}</Text>
        </Pressable>
        <Pressable style={[styles.shortcut, styles.shortcutGold]} onPress={() => router.push("/(tabs)/more")}>
          <Text style={[styles.shortcutT, { color: colors.navy }]}>{t("more")}</Text>
        </Pressable>
      </View>

      {isPureCoach && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("coachSpace")}</Text>
          <Text style={styles.muted}>{t("coachSpaceHint")}</Text>
          <View style={[styles.shortcuts, { marginTop: 10, flexWrap: "wrap" }]}>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/athletes")}>
              <Text style={styles.shortcutT}>{t("athletes")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/teams")}>
              <Text style={styles.shortcutT}>{t("teams")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/agenda")}>
              <Text style={styles.shortcutT}>{t("agenda")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/messages")}>
              <Text style={styles.shortcutT}>{t("messages")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isStaffOps && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("staffSpace")}</Text>
          <View style={[styles.shortcuts, { marginTop: 10, flexWrap: "wrap" }]}>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/athletes")}>
              <Text style={styles.shortcutT}>{t("athletes")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/registrations")}>
              <Text style={styles.shortcutT}>{t("registrations")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/teams")}>
              <Text style={styles.shortcutT}>{t("teams")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/payments")}>
              <Text style={styles.shortcutT}>{t("payments")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/inventory")}>
              <Text style={styles.shortcutT}>{t("inventory")}</Text>
            </Pressable>
            <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/history")}>
              <Text style={styles.shortcutT}>{t("history")}</Text>
            </Pressable>
            {(role === "admin" || role === "direction") && (
              <Pressable style={[styles.shortcut, styles.shortcutHalf]} onPress={() => router.push("/(tabs)/users")}>
                <Text style={styles.shortcutT}>{t("users")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isParent && (
        <>
          <Text style={styles.section}>{t("parentSpace")} / أبنائي</Text>
          <Text style={styles.muted}>{t("parentSpaceHint")}</Text>
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
          {!home?.children?.length && <Text style={styles.muted}>{t("noChildren")}</Text>}
        </>
      )}

      <Text style={styles.section}>{t("planning")}</Text>
      {(home?.upcoming_events || []).map((e) => {
        const badge = sessionBadge(e.session_status, e.is_cancelled);
        const place = e.location_text || e.location;
        return (
          <Pressable key={e.id} style={styles.card} onPress={() => router.push("/(tabs)/agenda")}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{statusLabel(e.event_type)}</Text>
              <View style={[styles.pill, { backgroundColor: badge.bg }]}>
                <Text style={[styles.pillT, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{e.title}</Text>
            <Text style={styles.muted}>{fmtDate(e.starts_at)}</Text>
            {!!e.opponent && <Text style={styles.muted}>vs {e.opponent}</Text>}
            {!!place && <Text style={styles.muted}>📍 {place}</Text>}
          </Pressable>
        );
      })}
      {!home?.upcoming_events?.length && <Text style={styles.muted}>{t("noEvents")}</Text>}

      {isParent && (
        <Pressable style={[styles.shortcut, { marginTop: 4 }]} onPress={() => router.push("/(tabs)/profile")}>
          <Text style={styles.shortcutT}>{t("parentalPrefs")}</Text>
        </Pressable>
      )}

      <Text style={styles.section}>
        {t("notifications")}
        {unread > 0 ? ` (${unread})` : ""}
      </Text>
      {notifs.map((n) => (
        <Pressable
          key={n.id}
          style={[styles.card, !n.is_read && styles.unread]}
          onPress={async () => {
            await openNotification(n);
            void load();
          }}
        >
          <Text style={styles.badge}>{notifKindLabel(n.kind)}</Text>
          <Text style={styles.cardTitle}>{n.title}</Text>
          {!!n.body && (
            <Text style={styles.muted} numberOfLines={2}>
              {n.body}
            </Text>
          )}
          {!!n.created_at && <Text style={styles.muted}>{fmtDate(n.created_at)}</Text>}
        </Pressable>
      ))}
      {!notifs.length && <Text style={styles.muted}>{t("noNotifs")}</Text>}

      <Text style={styles.section}>{t("announcements")}</Text>
      {(home?.announcements || []).map((a) => (
        <Pressable key={a.id} style={styles.card} onPress={() => router.push("/(tabs)/messages")}>
          <Text style={styles.cardTitle}>{a.title}</Text>
          {!!a.title_ar && <Text style={styles.ar}>{a.title_ar}</Text>}
          <Text style={styles.muted} numberOfLines={3}>
            {a.body}
          </Text>
        </Pressable>
      ))}
      {!home?.announcements?.length && <Text style={styles.muted}>{t("noAnnouncements")}</Text>}

      <Pressable style={styles.wake} onPress={load}>
        <Text style={styles.wakeText}>{t("refresh")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  brand: { fontSize: 13, fontWeight: "800", color: colors.gold, letterSpacing: 0.3, marginBottom: 2 },
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
    minWidth: "22%",
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  shortcutHalf: { minWidth: "46%", flexGrow: 1 },
  shortcutGold: { backgroundColor: colors.gold },
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
  badgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillT: { fontSize: 11, fontWeight: "800" },
  unread: { borderColor: colors.gold, borderWidth: 1.5 },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  kpi: {
    flex: 1,
    backgroundColor: colors.softGray,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  kpiN: { fontWeight: "800", color: colors.blue, fontSize: 14, textAlign: "center" },
  kpiL: { color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "center" },
  wake: { marginVertical: 16, alignItems: "center" },
  wakeText: { color: colors.blue, fontWeight: "700" },
});
