import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme";

type Item = {
  title: string;
  titleAr: string;
  subtitle: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: string[] | null;
};

const ITEMS: Item[] = [
  {
    title: "Athlètes",
    titleAr: "اللاعبون",
    subtitle: "Fiches joueurs, statut, parents",
    route: "/(tabs)/athletes",
    icon: "people",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    title: "Inscriptions",
    titleAr: "التسجيلات",
    subtitle: "Nouvelles inscriptions & validations",
    route: "/(tabs)/registrations",
    icon: "document-text",
    roles: ["admin", "direction", "staff", "coach", "parent"],
  },
  {
    title: "Équipes / Coachs",
    titleAr: "الفرق / المدربون",
    subtitle: "Groupes U5–U14 et affectations",
    route: "/(tabs)/teams",
    icon: "football",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    title: "Finance / Caisse",
    titleAr: "المالية / الصندوق",
    subtitle: "Cotisations, recettes et dépenses",
    route: "/(tabs)/payments",
    icon: "cash",
    roles: ["admin", "direction", "staff", "coach", "parent"],
  },
  {
    title: "Matériel",
    titleAr: "المعدات",
    subtitle: "Stock, achats et prêts",
    route: "/(tabs)/inventory",
    icon: "cube",
    roles: ["admin", "direction", "staff"],
  },
  {
    title: "Historique",
    titleAr: "السجل",
    subtitle: "Journal d’audit du club",
    route: "/(tabs)/history",
    icon: "time",
    roles: ["admin", "direction", "staff"],
  },
  {
    title: "Agenda",
    titleAr: "الجدول",
    subtitle: "Séances, présences, convocations",
    route: "/(tabs)/agenda",
    icon: "calendar",
    roles: null,
  },
  {
    title: "Messages",
    titleAr: "الرسائل",
    subtitle: "Annonces du club",
    route: "/(tabs)/messages",
    icon: "chatbubbles",
    roles: null,
  },
  {
    title: "Profil",
    titleAr: "الملف",
    subtitle: "Compte, enfants, déconnexion",
    route: "/(tabs)/profile",
    icon: "person-circle",
    roles: null,
  },
];

export default function MoreScreen() {
  const { role, fullName } = useAuth();
  const visible = ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Text style={styles.h}>Plus / المزيد</Text>
      <Text style={styles.muted}>
        {fullName || "Utilisateur"} · rôle {role || "—"} — tous les modules du club sur mobile.
      </Text>

      <View style={styles.hint}>
        <Ionicons name="information-circle" size={20} color={colors.blue} />
        <Text style={styles.hintText}>
          Athlètes, inscriptions, équipes, finance, matériel et historique sont ici (onglet Plus).
        </Text>
      </View>

      {visible.map((item) => (
        <Pressable
          key={item.route + item.title}
          style={styles.card}
          onPress={() => router.push(item.route as never)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={26} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.ar}>{item.titleAr}</Text>
            <Text style={styles.sub}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.muted} />
        </Pressable>
      ))}
      {!visible.length && <Text style={styles.muted}>Aucun module disponible pour ce rôle.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 22, fontWeight: "800", color: colors.blue },
  muted: { color: colors.muted, lineHeight: 20, marginBottom: 4 },
  hint: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.softBlue,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  hintText: { flex: 1, color: colors.navy, lineHeight: 19, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  ar: { color: colors.blue, marginTop: 1, fontSize: 13 },
  sub: { color: colors.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
});
