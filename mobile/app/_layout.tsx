import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

function Guard({ children }: { children: React.ReactNode }) {
  const { ready, token, mustChangePassword } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    const onChange = segments[0] === "change-password";
    if (!token && !onLogin) router.replace("/login");
    else if (token && mustChangePassword && !onChange) router.replace("/change-password");
    else if (token && !mustChangePassword && onLogin) router.replace("/(tabs)");
    // voluntary change-password from Profil is allowed when already authenticated
  }, [ready, token, mustChangePassword, segments]);

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
          <Stack.Screen name="change-password" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </Guard>
    </AuthProvider>
  );
}
