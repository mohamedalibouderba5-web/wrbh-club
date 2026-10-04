import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useI18n } from "../../src/context/I18nContext";
import { WEB_BASE } from "../../src/config";
import { colors } from "../../src/theme";

type Item = {
  key:
    | "athletes"
    | "registrations"
    | "teams"
    | "users"
    | "payments"
    | "inventory"
    | "history"
    | "agenda"
    | "messages"
    | "feedback"
    | "profile"
    | "pricing"
    | "guide"
    | "platform";
  subtitleFr: string;
  subtitleAr: string;
  route?: string;
  url?: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: string[] | null;
};

const ITEMS: Item[] = [
  {
    key: "platform",
    subtitleFr: "Dashboard multi-clubs, présence, suspension",
    subtitleAr: "لوحة كل الأندية والحضور والتعليق",
    route: "/(tabs)/platform",
    icon: "globe",
    roles: ["superadmin"],
  },
  {
    key: "athletes",
    subtitleFr: "Fiches joueurs, statut, parents",
    subtitleAr: "بطاقات اللاعبين والحالة والأولياء",
    route: "/(tabs)/athletes",
    icon: "people",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    key: "registrations",
    subtitleFr: "Nouvelles inscriptions & validations",
    subtitleAr: "التسجيلات الجديدة والتحقق",
    route: "/(tabs)/registrations",
    icon: "document-text",
    roles: ["admin", "direction", "staff", "coach", "parent"],
  },
  {
    key: "teams",
    subtitleFr: "Groupes et affectations coachs",
    subtitleAr: "المجموعات وتعيين المدربين",
    route: "/(tabs)/teams",
    icon: "football",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    key: "users",
    subtitleFr: "Créer / activer coachs, staff, parents",
    subtitleAr: "إنشاء / تفعيل المدربين والطاقم والأولياء",
    route: "/(tabs)/users",
    icon: "shield-checkmark",
    roles: ["admin", "direction"],
  },
  {
    key: "payments",
    subtitleFr: "Cotisations, recettes et dépenses",
    subtitleAr: "الاشتراكات والإيرادات والمصاريف",
    route: "/(tabs)/payments",
    icon: "cash",
    roles: ["admin", "direction", "staff"],
  },
  {
    key: "inventory",
    subtitleFr: "Stock, achats et prêts",
    subtitleAr: "المخزون والمشتريات والإعارات",
    route: "/(tabs)/inventory",
    icon: "cube",
    roles: ["admin", "direction", "staff"],
  },
  {
    key: "history",
    subtitleFr: "Journal d’audit du club",
    subtitleAr: "سجل تدقيق النادي",
    route: "/(tabs)/history",
    icon: "time",
    roles: ["admin", "direction", "staff"],
  },
  {
    key: "agenda",
    subtitleFr: "Séances, présences, convocations",
    subtitleAr: "الحصص والحضور والاستدعاءات",
    route: "/(tabs)/agenda",
    icon: "calendar",
    roles: null,
  },
  {
    key: "messages",
    subtitleFr: "Annonces du club",
    subtitleAr: "إعلانات النادي",
    route: "/(tabs)/messages",
    icon: "chatbubbles",
    roles: null,
  },
  {
    key: "feedback",
    subtitleFr: "Signaler un bug ou une idée",
    subtitleAr: "الإبلاغ عن خلل أو فكرة",
    route: "/(tabs)/feedback",
    icon: "chatbubble-ellipses",
    roles: null,
  },
  {
    key: "profile",
    subtitleFr: "Compte, langue, déconnexion",
    subtitleAr: "الحساب واللغة وتسجيل الخروج",
    route: "/(tabs)/profile",
    icon: "person-circle",
    roles: null,
  },
  {
    key: "pricing",
    subtitleFr: "Discovery · Club · Academy",
    subtitleAr: "Discovery · Club · Academy",
    url: `${WEB_BASE}/pricing`,
    icon: "pricetag",
    roles: null,
  },
  {
    key: "guide",
    subtitleFr: "Mode d’emploi Nadi Connect",
    subtitleAr: "دليل استخدام Nadi Connect",
    route: "/(tabs)/guide",
    icon: "book",
    roles: null,
  },
];

export default function MoreScreen() {
  const { role, fullName } = useAuth();
  const { t, lang } = useI18n();
  const visible = ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Text style={styles.h}>{t("moreTitle")}</Text>
      <Text style={styles.muted}>
        {fullName || "—"} · {role || "—"}
      </Text>

      <View style={styles.hint}>
        <Ionicons name="information-circle" size={20} color={colors.blue} />
        <Text style={styles.hintText}>{t("moreHint")}</Text>
      </View>

      {visible.map((item) => (
        <Pressable
          key={(item.route || item.url || "") + item.key}
          style={styles.card}
          onPress={() => {
            if (item.url) void Linking.openURL(item.url);
            else if (item.route) router.push(item.route as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={t(item.key)}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={26} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t(item.key)}</Text>
            <Text style={styles.sub}>{lang === "ar" ? item.subtitleAr : item.subtitleFr}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 22, fontWeight: "800", color: colors.blue },
  muted: { color: colors.muted, marginBottom: 4 },
  hint: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e8eefc",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  hintText: { flex: 1, color: colors.navy, lineHeight: 20, fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#e8eefc",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  sub: { color: colors.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
});
