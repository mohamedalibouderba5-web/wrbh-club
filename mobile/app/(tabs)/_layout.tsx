import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ color: focused ? "#F5C518" : "#9aa6c2", fontSize: 11, fontWeight: "700" }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1E3A8A" },
        headerTintColor: "white",
        tabBarStyle: { backgroundColor: "#0f1f4d", borderTopColor: "#1E3A8A" },
        tabBarActiveTintColor: "#F5C518",
        tabBarInactiveTintColor: "#9aa6c2",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarLabel: ({ focused }) => <TabLabel label="Accueil" focused={focused} /> }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarLabel: ({ focused }) => <TabLabel label="Agenda" focused={focused} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Paiements", tabBarLabel: ({ focused }) => <TabLabel label="Paiements" focused={focused} /> }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarLabel: ({ focused }) => <TabLabel label="Messages" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarLabel: ({ focused }) => <TabLabel label="Profil" focused={focused} /> }} />
    </Tabs>
  );
}
