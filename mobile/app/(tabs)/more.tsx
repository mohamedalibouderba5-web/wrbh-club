import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
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
    | "announcements"
    | "agenda"
    | "messages"
    | "feedback"
    | "profile"
    | "pricing"
    | "guide"
    | "platform";
  subtitleFr: string;
  subtitleAr: string;
  route?: Href;
  url?: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: string[] | null;
  testID?: string;
  /** Titre forcé FR (QA Automator) */
  titleFr?: string;
  titleAr?: string;
};

/** Ordre staff : Matériel / Historique / Annonces tôt dans la liste (A1–A3 / Nox) */
const ITEMS: Item[] = [
  {
    key: "platform",
    subtitleFr: "Dashboard multi-clubs, présence, suspension",
    subtitleAr: "لوحة كل الأندية والحضور والتعليق",
    route: "/(tabs)/platform",
    icon: "globe",
    roles: ["superadmin"],
    testID: "more-platform",
  },
  {
    key: "athletes",
    subtitleFr: "Fiches joueurs, statut, parents",
    subtitleAr: "بطاقات اللاعبين والحالة والأولياء",
    route: "/(tabs)/athletes",
    icon: "people",
    roles: ["admin", "direction", "staff", "coach"],
    testID: "more-athletes",
  },
  {
    key: "registrations",
    subtitleFr: "Nouvelles inscriptions & validations",
    subtitleAr: "التسجيلات الجديدة والتحقق",
    route: "/(tabs)/registrations",
    icon: "document-text",
    roles: ["admin", "direction", "staff", "parent"],
    testID: "more-registrations",
  },
  {
    key: "teams",
    subtitleFr: "Groupes et affectations coachs",
    subtitleAr: "المجموعات وتعيين المدربين",
    route: "/(tabs)/teams",
    icon: "football",
    roles: ["admin", "direction", "staff", "coach"],
    testID: "more-teams",
  },
  {
    key: "users",
    subtitleFr: "Créer / activer coachs, staff, parents",
    subtitleAr: "إنشاء / تفعيل المدربين والطاقم والأولياء",
    route: "/(tabs)/users",
    icon: "shield-checkmark",
    roles: ["admin", "direction"],
    testID: "more-users",
  },
  {
    key: "payments",
    subtitleFr: "Finance — cotisations, recettes et dépenses",
    subtitleAr: "المالية — الاشتراكات والإيرادات والمصاريف",
    route: "/(tabs)/payments",
    icon: "cash",
    roles: ["admin", "direction", "staff"],
    testID: "more-payments",
  },
  {
    key: "inventory",
    titleFr: "Matériel",
    titleAr: "المعدات",
    subtitleFr: "Stock, achats et prêts",
    subtitleAr: "المخزون والمشتريات والإعارات",
    route: "/(tabs)/inventory",
    icon: "cube",
    roles: ["admin", "direction", "staff"],
    testID: "more-inventory",
  },
  {
    key: "history",
    titleFr: "Historique",
    titleAr: "السجل",
    subtitleFr: "Journal d’audit du club",
    subtitleAr: "سجل تدقيق النادي",
    route: "/(tabs)/history",
    icon: "time",
    roles: ["admin", "direction", "staff"],
    testID: "more-history",
  },
  {
    key: "announcements",
    titleFr: "Annonces",
    titleAr: "الإعلانات",
    subtitleFr: "Fil d’annonces du club",
    subtitleAr: "شريط إعلانات النادي",
    route: "/(tabs)/messages",
    icon: "megaphone",
    roles: ["admin", "direction", "staff", "coach", "parent"],
    testID: "more-announcements",
  },
  {
    key: "agenda",
    subtitleFr: "Séances, présences, convocations",
    subtitleAr: "الحصص والحضور والاستدعاءات",
    route: "/(tabs)/agenda",
    icon: "calendar",
    roles: null,
    testID: "more-agenda",
  },
  {
    key: "messages",
    subtitleFr: "Messages et notifications",
    subtitleAr: "الرسائل والإشعارات",
    route: "/(tabs)/messages",
    icon: "chatbubbles",
    roles: null,
    testID: "more-messages",
  },
  {
    key: "feedback",
    subtitleFr: "Signaler un bug ou une idée",
    subtitleAr: "الإبلاغ عن خلل أو فكرة",
    route: "/(tabs)/feedback",
    icon: "chatbubble-ellipses",
    roles: null,
    testID: "more-feedback",
  },
  {
    key: "profile",
    subtitleFr: "Compte, langue, déconnexion",
    subtitleAr: "الحساب واللغة وتسجيل الخروج",
    route: "/(tabs)/profile",
    icon: "person-circle",
    roles: null,
    testID: "more-profile",
  },
  {
    key: "pricing",
    subtitleFr: "Discovery · Club · Academy",
    subtitleAr: "Discovery · Club · Academy",
    url: `${WEB_BASE}/pricing`,
    icon: "pricetag",
    roles: null,
    testID: "more-pricing",
  },
  {
    key: "guide",
    subtitleFr: "Mode d’emploi Nadi Connect",
    subtitleAr: "دليل استخدام نادي كونكت",
    route: "/(tabs)/guide",
    icon: "book",
    roles: null,
    testID: "more-guide",
  },
];

function MoreRow({
  item,
  title,
  subtitle,
}: {
  item: Item;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const content = (
    <>
      <View style={styles.iconWrap} pointerEvents="none">
        <Ionicons name={item.icon} size={26} color={colors.blue} />
      </View>
      <View style={{ flex: 1 }} pointerEvents="none">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} pointerEvents="none" />
    </>
  );

  // G2-01 / A1–A3 : router.push + zone tactile large (Automator/Nox)
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => {
        if (item.url) {
          void Linking.openURL(item.url);
          return;
        }
        if (!item.route) return;
        const href = item.route as Href;
        requestAnimationFrame(() => {
          try {
            router.push(href);
          } catch {
            try {
              router.navigate(href);
            } catch {
              /* ignore */
            }
          }
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={item.testID}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      android_ripple={{ color: "#c7d2fe" }}
      delayPressIn={0}
    >
      {content}
    </Pressable>
  );
}

export default function MoreScreen() {
  const { role, fullName } = useAuth();
  const { t, lang } = useI18n();
  const visible = ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));
  // Éviter doublon Messages / Annonces pour staff (Annonces suffit)
  const filtered =
    role === "admin" || role === "direction" || role === "staff"
      ? visible.filter((i) => i.key !== "messages")
      : visible.filter((i) => i.key !== "announcements");
  const hint =
    role === "parent"
      ? lang === "ar"
        ? "تسجيلات أطفالكم، الجدول، الرسائل والملف الشخصي."
        : "Inscriptions de vos enfants, agenda, messages et profil."
      : role === "coach"
        ? lang === "ar"
          ? "اللاعبون والفرق والجدول والرسائل — بدون مالية ولا عتاد."
          : "Athlètes, équipes, agenda et messages — pas de finance ni matériel."
        : role === "superadmin"
          ? lang === "ar"
            ? "لوحة المنصة وتعليق الأندية."
            : "Console plateforme et gestion des clubs."
          : t("moreHint");

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 56 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.h}>{t("moreTitle")}</Text>
      <Text style={styles.muted}>
        {fullName || "—"} · {role || "—"}
      </Text>

      <View style={styles.hint}>
        <Ionicons name="information-circle" size={20} color={colors.blue} />
        <Text style={styles.hintText}>{hint}</Text>
      </View>

      {filtered.map((item) => {
        const title =
          lang === "ar"
            ? item.titleAr || t(item.key)
            : item.titleFr || t(item.key);
        return (
          <MoreRow
            key={item.key}
            item={item}
            title={title}
            subtitle={lang === "ar" ? item.subtitleAr : item.subtitleFr}
          />
        );
      })}
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
    paddingVertical: 18,
    paddingHorizontal: 14,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardPressed: { opacity: 0.85, backgroundColor: "#f1f5f9" },
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
