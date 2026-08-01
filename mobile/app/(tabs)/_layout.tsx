import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";

const BLUE = "#1E3A8A";
const NAVY = "#0f1f4d";
const GOLD = "#F5C518";
const MUTED = "#9aa6c2";

type IconName = ComponentProps<typeof Ionicons>["name"];

const TAB_META: Record<
  string,
  { title: string; active: IconName; inactive: IconName; glyph: string }
> = {
  index: { title: "Accueil", active: "home", inactive: "home-outline", glyph: "⌂" },
  agenda: { title: "Agenda", active: "calendar", inactive: "calendar-outline", glyph: "▦" },
  payments: { title: "Paiements", active: "card", inactive: "card-outline", glyph: "💳" },
  messages: { title: "Messages", active: "chatbubbles", inactive: "chatbubbles-outline", glyph: "💬" },
  more: { title: "Plus", active: "grid", inactive: "grid-outline", glyph: "☰" },
};

function TabIcon({
  routeName,
  focused,
  color,
  size,
}: {
  routeName: string;
  focused: boolean;
  color: string;
  size: number;
}) {
  const meta = TAB_META[routeName];
  if (!meta) return <Text style={{ color, fontSize: size }}>•</Text>;
  try {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", minWidth: 28 }}>
        <Ionicons name={focused ? meta.active : meta.inactive} size={size + 2} color={color} />
      </View>
    );
  } catch {
    return <Text style={{ color, fontSize: size, fontWeight: "800" }}>{meta.glyph}</Text>;
  }
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name];
        return {
          headerStyle: { backgroundColor: BLUE },
          headerTintColor: "white",
          headerTitleStyle: { fontWeight: "800", fontSize: 18 },
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: NAVY,
            borderTopColor: BLUE,
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 10,
            paddingTop: 6,
          },
          tabBarActiveTintColor: GOLD,
          tabBarInactiveTintColor: MUTED,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "800", marginTop: 2 },
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon routeName={route.name} focused={focused} color={color} size={size} />
          ),
          title: meta?.title,
        };
      }}
    >
      {/* 5 onglets visibles sur le téléphone */}
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarLabel: "Accueil" }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarLabel: "Agenda" }} />
      <Tabs.Screen name="payments" options={{ title: "Paiements", tabBarLabel: "Paiements" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarLabel: "Messages" }} />
      <Tabs.Screen
        name="more"
        options={{
          title: "Plus",
          tabBarLabel: "Plus",
          tabBarAccessibilityLabel: "Plus — athlètes, inscriptions, équipes, matériel",
        }}
      />

      {/* Écrans accessibles depuis Plus (pas dans la barre) */}
      <Tabs.Screen name="profile" options={{ title: "Profil", href: null }} />
      <Tabs.Screen name="athletes" options={{ title: "Athlètes", href: null }} />
      <Tabs.Screen name="registrations" options={{ title: "Inscriptions", href: null }} />
      <Tabs.Screen name="inventory" options={{ title: "Matériel", href: null }} />
      <Tabs.Screen name="history" options={{ title: "Historique", href: null }} />
      <Tabs.Screen name="teams" options={{ title: "Équipes", href: null }} />
    </Tabs>
  );
}
