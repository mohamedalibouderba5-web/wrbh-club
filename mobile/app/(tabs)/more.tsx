import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme";

type Item = {
  title: string;
  subtitle: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: string[] | null;
};

const ITEMS: Item[] = [
  {
    title: "Athlètes",
    subtitle: "Fiches joueurs, statut, parents",
    route: "/(tabs)/athletes",
    icon: "people",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    title: "Inscriptions",
    subtitle: "Nouvelles inscriptions & validations",
    route: "/(tabs)/registrations",
    icon: "clipboard",
    roles: ["admin", "direction", "staff", "parent"],
  },
  {
    title: "Équipes / Coachs",
    subtitle: "Groupes U7–U14 et affectations",
    route: "/(tabs)/teams",
    icon: "shirt",
    roles: ["admin", "direction", "staff", "coach"],
  },
  {
    title: "Matériel",
    subtitle: "Stock, achats et prêts",
    route: "/(tabs)/inventory",
    icon: "cube",
    roles: ["admin", "direction", "staff"],
  },
  {
    title: "Historique",
    subtitle: "Journal d’audit du club",
    route: "/(tabs)/history",
    icon: "time",
    roles: ["admin", "direction", "staff"],
  },
  {
    title: "Profil",
    subtitle: "Compte, enfants, déconnexion",
    route: "/(tabs)/profile",
    icon: "person-circle",
    roles: null,
  },
];

export default function MoreScreen() {
  const { role } = useAuth();
  const visible = ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Tous les modules</Text>
      <Text style={styles.muted}>
        Accès mobile aux fonctions du site — selon votre rôle ({role || "—"}).
      </Text>
      {visible.map((item) => (
        <Pressable key={item.route} style={styles.card} onPress={() => router.push(item.route as never)}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={24} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}
      {!visible.length && <Text style={styles.muted}>Aucun module disponible pour ce rôle.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  muted: { color: colors.muted, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  sub: { color: colors.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
});
