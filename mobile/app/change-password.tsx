import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { changePassword } from "../src/api/client";
import { useAuth } from "../src/context/AuthContext";

export default function ChangePasswordScreen() {
  const { clearMustChangePassword, logout, mustChangePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (next.length < 8) {
      Alert.alert("Erreur", "Minimum 8 caractères");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Erreur", "Confirmation différente");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      await clearMustChangePassword();
      Alert.alert("OK", "Mot de passe mis à jour");
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Nouveau mot de passe</Text>
      <Text style={styles.hint}>
        {mustChangePassword
          ? "Obligatoire au premier login (sécurité compte)."
          : "Choisissez un mot de passe solide (8 caractères minimum)."}
      </Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Mot de passe actuel"
        value={current}
        onChangeText={setCurrent}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Nouveau (min. 8)"
        value={next}
        onChangeText={setNext}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Confirmer"
        value={confirm}
        onChangeText={setConfirm}
      />
      <Pressable style={styles.btn} onPress={onSave} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "…" : "Enregistrer"}</Text>
      </Pressable>
      {!mustChangePassword && (
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      )}
      <Pressable onPress={() => void logout()}>
        <Text style={styles.link}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0f172a", padding: 24, justifyContent: "center", gap: 12 },
  title: { color: "#F5C518", fontSize: 22, fontWeight: "800" },
  hint: { color: "#94a3b8", marginBottom: 8, lineHeight: 20 },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 15 },
  btn: { backgroundColor: "#1E3A8A", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { color: "#F5C518", textAlign: "center", marginTop: 8, fontWeight: "700" },
});
