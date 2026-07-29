import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

const BLUE = "#1E3A8A";
const NAVY = "#0f1f4d";
const GOLD = "#F5C518";
const MUTED = "#9aa6c2";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "home", inactive: "home-outline" },
  agenda: { active: "calendar", inactive: "calendar-outline" },
  payments: { active: "card", inactive: "card-outline" },
  messages: { active: "chatbubbles", inactive: "chatbubbles-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const icons = ICONS[route.name] || { active: "ellipse", inactive: "ellipse-outline" };
        return {
          headerStyle: { backgroundColor: BLUE },
          headerTintColor: "white",
          headerTitleStyle: { fontWeight: "800" },
          tabBarStyle: {
            backgroundColor: NAVY,
            borderTopColor: BLUE,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: GOLD,
          tabBarInactiveTintColor: MUTED,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />
          ),
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
      <Tabs.Screen name="payments" options={{ title: "Paiements" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
