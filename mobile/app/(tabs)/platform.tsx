import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { useI18n } from "../../src/context/I18nContext";
import { colors } from "../../src/theme";

type Dashboard = {
  online_window_minutes: number;
  clubs: {
    total: number;
    active: number;
    suspended: number;
    trials_expiring_7d: number;
    by_plan: Record<string, number>;
  };
  users: {
    total: number;
    active: number;
    by_role: Record<string, number>;
    online: number;
    online_by_role: Record<string, number>;
  };
  activity: {
    athletes_total: number;
    registrations_month: number;
    payments_month: number;
    payments_amount_month: number;
  };
  online_users: {
    id: number;
    full_name: string;
    role: string;
    club_name?: string | null;
    club_slug?: string | null;
    last_seen_at?: string | null;
  }[];
  recent_clubs: {
    id: number;
    slug: string;
    name: string;
    name_ar?: string | null;
    plan?: string | null;
    status?: string | null;
    athletes_count: number;
    users_count?: number;
    online_count?: number;
  }[];
};

function fmt(n: number | undefined) {
  return new Intl.NumberFormat("fr-DZ").format(n || 0);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

export default function PlatformScreen() {
  const { role } = useAuth();
  const { lang } = useI18n();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const d = await api<Dashboard>("/api/v1/admin/dashboard");
      setDash(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role === "superadmin") void load();
    }, [role, load]),
  );

  if (role !== "superadmin") {
    return <Redirect href="/(tabs)/more" />;
  }

  async function toggleClub(id: number, status: string | null | undefined) {
    const next = (status || "").toLowerCase() === "suspended" ? "active" : "suspended";
    setBusyId(id);
    try {
      await api(`/api/v1/admin/clubs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  const ar = lang === "ar";

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.h}>{ar ? "منصة Nadi Connect" : "Plateforme Nadi Connect"}</Text>
      <Text style={styles.muted}>
        {ar
          ? "لوحة المشرف — الأندية والحسابات والمتصلون"
          : "Console super-admin — clubs, comptes, présence"}
      </Text>

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {loading && !dash ? <ActivityIndicator color={colors.blue} /> : null}

      {dash ? (
        <>
          <View style={styles.kpiGrid}>
            <Kpi label={ar ? "أندية" : "Clubs"} value={fmt(dash.clubs.total)} hint={`${fmt(dash.clubs.active)} ${ar ? "نشط" : "actifs"}`} />
            <Kpi label={ar ? "متصلون" : "En ligne"} value={fmt(dash.users.online)} hint={`${dash.online_window_minutes} min`} />
            <Kpi label={ar ? "أولياء متصلون" : "Parents online"} value={fmt(dash.users.online_by_role?.parent || 0)} />
            <Kpi label={ar ? "حسابات" : "Comptes"} value={fmt(dash.users.total)} />
            <Kpi label={ar ? "لاعبون" : "Athlètes"} value={fmt(dash.activity.athletes_total)} />
            <Kpi label={ar ? "مدفوعات الشهر" : "Paiements mois"} value={fmt(dash.activity.payments_month)} />
            <Kpi label={ar ? "معلق" : "Suspendus"} value={fmt(dash.clubs.suspended)} />
            <Kpi label={ar ? "تجربة ≤7ج" : "Essais ≤7j"} value={fmt(dash.clubs.trials_expiring_7d)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ar ? "حسب الدور" : "Par rôle"}</Text>
            {Object.entries(dash.users.by_role || {}).map(([r, n]) => (
              <View key={r} style={styles.row}>
                <Text style={styles.rowLabel}>{r}</Text>
                <Text style={styles.rowValue}>
                  {fmt(n)} · {fmt(dash.users.online_by_role?.[r] || 0)} {ar ? "متصل" : "online"}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ar ? "المتصلون الآن" : "Connectés maintenant"}</Text>
            {(dash.online_users || []).length === 0 ? (
              <Text style={styles.muted}>{ar ? "لا أحد متصل" : "Personne en ligne"}</Text>
            ) : (
              dash.online_users.map((u) => (
                <View key={u.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{u.full_name}</Text>
                    <Text style={styles.muted}>
                      {u.role} · {u.club_name || u.club_slug || "—"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ar ? "الأندية" : "Clubs"}</Text>
            {(dash.recent_clubs || []).map((c) => {
              const suspended = (c.status || "").toLowerCase() === "suspended";
              return (
                <View key={c.id} style={styles.clubRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{ar && c.name_ar ? c.name_ar : c.name}</Text>
                    <Text style={styles.muted}>
                      {c.slug} · {c.plan || "—"} · {c.status || "—"}
                    </Text>
                    <Text style={styles.muted}>
                      {fmt(c.athletes_count)} {ar ? "لاعب" : "athlètes"} · {fmt(c.online_count)}{" "}
                      {ar ? "متصل" : "online"}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.btn, suspended ? styles.btnOk : styles.btnDanger]}
                    disabled={busyId === c.id}
                    onPress={() => void toggleClub(c.id, c.status)}
                  >
                    <Text style={styles.btnText}>
                      {busyId === c.id ? "…" : suspended ? (ar ? "تفعيل" : "Réactiver") : ar ? "تعليق" : "Suspendre"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 22, fontWeight: "800", color: colors.blue },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  err: { color: "#b91c1c", fontWeight: "700" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: { color: colors.muted, fontSize: 12 },
  kpiValue: { color: colors.navy, fontSize: 22, fontWeight: "800", marginTop: 2 },
  kpiHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
  rowLabel: { fontWeight: "700", color: colors.navy },
  rowValue: { color: colors.muted, fontWeight: "600" },
  clubRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dbe3f5",
  },
  btn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnDanger: { backgroundColor: "#b91c1c" },
  btnOk: { backgroundColor: colors.blue },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
