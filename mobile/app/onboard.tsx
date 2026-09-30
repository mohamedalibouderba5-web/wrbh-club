import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { API_BASE } from "../src/config";
import { colors } from "../src/theme";

type SportOpt = { code: string; label: string };

const FALLBACK: SportOpt[] = [
  { code: "football", label: "Football" },
  { code: "judo", label: "Judo" },
  { code: "karate", label: "Karaté" },
  { code: "swimming", label: "Natation" },
  { code: "athletics", label: "Athlétisme" },
];

export default function OnboardScreen() {
  const [sports, setSports] = useState<SportOpt[]>(FALLBACK);
  const [clubName, setClubName] = useState("");
  const [slug, setSlug] = useState("");
  const [primarySport, setPrimarySport] = useState("football");
  const [extra, setExtra] = useState<string[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/club/sports`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setSports(rows);
      })
      .catch(() => undefined);
  }, []);

  function toggleExtra(code: string) {
    if (code === primarySport) return;
    setExtra((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  }

  async function submit() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const sportsList = [primarySport, ...extra.filter((s) => s !== primarySport)];
      const res = await fetch(`${API_BASE}/api/v1/club/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club_name: clubName.trim(),
          slug: slug.trim().toLowerCase(),
          sport: primarySport,
          sports: sportsList,
          admin_full_name: adminName.trim(),
          admin_email: adminEmail.trim(),
          admin_password: adminPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" · ")
              : "Création impossible";
        throw new Error(detail || "Création impossible");
      }
      setMsg(`Club créé : ${data.slug || slug}. Essai 14 jours. Connectez-vous.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.blue }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h}>Créer un club</Text>
      <Text style={styles.sub}>Essai gratuit 14 jours · multi-sport dès le départ</Text>

      <TextInput
        style={styles.input}
        placeholder="Nom du club"
        placeholderTextColor="#8a93a8"
        value={clubName}
        onChangeText={setClubName}
      />
      <TextInput
        style={styles.input}
        placeholder="Code club (slug) ex. mon-club"
        placeholderTextColor="#8a93a8"
        autoCapitalize="none"
        value={slug}
        onChangeText={setSlug}
      />
      <Text style={styles.label}>Sport principal</Text>
      <View style={styles.chips}>
        {sports.map((s) => (
          <Pressable
            key={s.code}
            style={[styles.chip, primarySport === s.code && styles.chipOn]}
            onPress={() => {
              setPrimarySport(s.code);
              setExtra((prev) => prev.filter((x) => x !== s.code));
            }}
          >
            <Text style={[styles.chipT, primarySport === s.code && styles.chipTOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Autres sports (optionnel)</Text>
      <View style={styles.chips}>
        {sports
          .filter((s) => s.code !== primarySport)
          .map((s) => (
            <Pressable
              key={s.code}
              style={[styles.chip, extra.includes(s.code) && styles.chipOn]}
              onPress={() => toggleExtra(s.code)}
            >
              <Text style={[styles.chipT, extra.includes(s.code) && styles.chipTOn]}>{s.label}</Text>
            </Pressable>
          ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Nom admin"
        placeholderTextColor="#8a93a8"
        value={adminName}
        onChangeText={setAdminName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email admin"
        placeholderTextColor="#8a93a8"
        autoCapitalize="none"
        keyboardType="email-address"
        value={adminEmail}
        onChangeText={setAdminEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe admin"
        placeholderTextColor="#8a93a8"
        secureTextEntry
        value={adminPassword}
        onChangeText={setAdminPassword}
      />
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}
      <Pressable
        style={[styles.btn, loading && { opacity: 0.7 }]}
        onPress={submit}
        disabled={
          loading ||
          !clubName.trim() ||
          !slug.trim() ||
          !adminName.trim() ||
          !adminEmail.trim() ||
          adminPassword.length < 6
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.navy} />
        ) : (
          <Text style={styles.btnText}>Créer le club</Text>
        )}
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.replace("/login")}>
        <Text style={styles.linkT}>← Retour connexion</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingBottom: 48, gap: 8 },
  h: { color: "white", fontSize: 24, fontWeight: "800", marginTop: 24 },
  sub: { color: "rgba(255,255,255,0.75)", marginBottom: 12 },
  label: { color: "rgba(255,255,255,0.9)", fontWeight: "700", marginTop: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginBottom: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.gold },
  chipT: { color: "white", fontWeight: "700", fontSize: 12 },
  chipTOn: { color: colors.navy },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: { color: colors.navy, fontWeight: "800", fontSize: 16 },
  link: { marginTop: 16, alignItems: "center" },
  linkT: { color: "white", textDecorationLine: "underline" },
  err: { color: "#ffb4b4", fontWeight: "700" },
  ok: { color: "#86efac", fontWeight: "700" },
});
