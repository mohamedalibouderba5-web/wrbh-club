import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { wakeServer } from "../src/api/client";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("parent@wrbh.local");
  const [password, setPassword] = useState("parent123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wakeMsg, setWakeMsg] = useState("");

  async function onLogin() {
    setLoading(true);
    setError("");
    try {
      await wakeServer().catch(() => undefined);
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onWake() {
    setWakeMsg("Réveil…");
    try {
      await wakeServer();
      setWakeMsg("Serveur OK");
    } catch {
      setWakeMsg("Échec — réessayez");
    }
  }

  return (
    <View style={styles.page}>
      <Image source={require("../assets/logo.png")} style={styles.logo} />
      <Text style={styles.title}>WRBH Club</Text>
      <Text style={styles.ar}>الوداد الرياضي لبلدية حمادي</Text>
      <Text style={styles.sub}>Parents · Coaches · Terrain</Text>

      <TextInput
        style={styles.input}
        placeholder="Email / téléphone"
        placeholderTextColor="#8a93a8"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#8a93a8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.btn} onPress={onLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#0f1f4d" /> : <Text style={styles.btnText}>Connexion</Text>}
      </Pressable>
      <Pressable style={styles.wake} onPress={onWake}>
        <Text style={styles.wakeText}>Actualiser / Réveiller le serveur</Text>
      </Pressable>
      {!!wakeMsg && <Text style={styles.sub}>{wakeMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#1E3A8A",
    padding: 24,
    justifyContent: "center",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#F5C518",
  },
  title: { color: "white", fontSize: 28, fontWeight: "800", textAlign: "center" },
  ar: { color: "#F5C518", textAlign: "center", marginTop: 4, fontSize: 16 },
  sub: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginVertical: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginBottom: 10,
  },
  btn: {
    backgroundColor: "#F5C518",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#0f1f4d", fontWeight: "800", fontSize: 16 },
  wake: { marginTop: 16, alignItems: "center" },
  wakeText: { color: "white", textDecorationLine: "underline" },
  error: { color: "#ffb4b4", textAlign: "center", marginBottom: 8 },
});
