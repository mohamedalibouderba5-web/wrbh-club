import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

function Guard({ children }: { children: React.ReactNode }) {
  const { ready, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!token && !onLogin) router.replace("/login");
    if (token && onLogin) router.replace("/(tabs)");
  }, [ready, token, segments]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1E3A8A" }}>
        <ActivityIndicator color="#F5C518" size="large" />
      </View>
    );
  }
  return children;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Guard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </Guard>
    </AuthProvider>
  );
}
