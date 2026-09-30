import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { API_BASE, mediaUrl } from "../src/config";
import { wakeServer } from "../src/api/client";
import { colors, statusLabel } from "../src/theme";

type ClubPublic = {
  slug: string;
  name: string;
  name_ar?: string | null;
  acronym: string;
  sport: string;
  primary_color: string;
  accent_color: string;
  logo_path?: string | null;
  app_name?: string | null;
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clubSlug, setClubSlug] = useState("");
  const [clubs, setClubs] = useState<ClubPublic[]>([]);
  const [brand, setBrand] = useState<ClubPublic | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wakeMsg, setWakeMsg] = useState("");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("wrbh_club_slug");
      if (saved) setClubSlug(saved);
      try {
        const res = await fetch(`${API_BASE}/api/v1/club/list`);
        if (!res.ok) return;
        const data = (await res.json()) as ClubPublic[];
        setClubs(data);
        if (!saved && data.some((c) => c.slug === "wrbh")) setClubSlug("wrbh");
        else if (!saved && data.length === 1) setClubSlug(data[0].slug);
      } catch {
        /* mono-club fallback */
      }
    })();
  }, []);

  useEffect(() => {
    if (!clubSlug) {
      setBrand(null);
      return;
    }
    const local = clubs.find((c) => c.slug === clubSlug);
    if (local) setBrand(local);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/club/branding?slug=${encodeURIComponent(clubSlug)}`);
        if (!res.ok || cancelled) return;
        const b = await res.json();
        if (cancelled) return;
        setBrand({
          slug: b.slug || clubSlug,
          name: b.name,
          name_ar: b.name_ar,
          acronym: b.acronym || "CLUB",
          sport: b.sport || "football",
          primary_color: b.primary_color || colors.blue,
          accent_color: b.accent_color || colors.gold,
          logo_path: b.logo_path,
          app_name: b.app_name,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubSlug, clubs]);

  async function onLogin() {
    setLoading(true);
    setError("");
    try {
      await wakeServer().catch(() => undefined);
      if (clubSlug.trim()) await AsyncStorage.setItem("wrbh_club_slug", clubSlug.trim());
      await login(username.trim(), password, clubSlug.trim() || undefined);
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

  const primary = brand?.primary_color || colors.blue;
  const accent = brand?.accent_color || colors.gold;
  const title = brand?.app_name || brand?.name || "WRBH Club";
  const subtitle = brand?.name_ar || "الوداد الرياضي لبلدية حمادي";
  const logoUri = mediaUrl(brand?.logo_path || undefined);

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: primary }]} keyboardShouldPersistTaps="handled">
      {logoUri ? (
        <Image source={{ uri: logoUri }} style={[styles.logo, { borderColor: accent }]} />
      ) : (
        <Image source={require("../assets/logo.png")} style={[styles.logo, { borderColor: accent }]} />
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.ar, { color: accent }]}>{subtitle}</Text>
      {!!brand?.sport && (
        <Text style={styles.sub}>
          Sport : {statusLabel(brand.sport) || brand.sport} · slug {clubSlug || "—"}
        </Text>
      )}
      {!brand?.sport && <Text style={styles.sub}>Connexion multi-club · parent ☎ / staff email</Text>}

      {clubs.length > 0 && (
        <View style={styles.clubBox}>
          <Text style={styles.clubLabel}>Club / النادي</Text>
          <View style={styles.clubChips}>
            {clubs.map((c) => (
              <Pressable
                key={c.slug}
                style={[styles.chip, clubSlug === c.slug && { backgroundColor: accent }]}
                onPress={() => setClubSlug(c.slug)}
              >
                <Text style={[styles.chipT, clubSlug === c.slug && { color: colors.navy }]}>
                  {c.acronym || c.slug}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ou code club (slug)"
            placeholderTextColor="#8a93a8"
            autoCapitalize="none"
            value={clubSlug}
            onChangeText={setClubSlug}
            editable={!loading}
          />
        </View>
      )}

      {!clubs.length && (
        <TextInput
          style={styles.input}
          placeholder="Code club (slug) — optionnel"
          placeholderTextColor="#8a93a8"
          autoCapitalize="none"
          value={clubSlug}
          onChangeText={setClubSlug}
          editable={!loading}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="0555… ou email staff"
        placeholderTextColor="#8a93a8"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        value={username}
        onChangeText={setUsername}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe / كلمة المرور"
        placeholderTextColor="#8a93a8"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        onSubmitEditing={onLogin}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
        onPress={onLogin}
        disabled={loading || !username.trim() || !password}
      >
        {loading ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.btnText}>Connexion / دخول</Text>}
      </Pressable>
      <Text style={styles.hint}>
        Parents : téléphone. Staff : email. Multi-club : choisissez le club (ex. wrbh, demo-judo-978).
      </Text>
      <Pressable style={styles.wake} onPress={onWake}>
        <Text style={styles.wakeText}>Actualiser / Réveiller le serveur</Text>
      </Pressable>
      {!!wakeMsg && <Text style={styles.sub}>{wakeMsg}</Text>}
      <Pressable style={styles.wake} onPress={() => router.push("/onboard")}>
        <Text style={[styles.wakeText, { color: accent }]}>Créer un club (essai 14 j)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    paddingVertical: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 3,
  },
  title: { color: "white", fontSize: 26, fontWeight: "800", textAlign: "center" },
  ar: { textAlign: "center", marginTop: 4, fontSize: 15 },
  sub: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginVertical: 10 },
  hint: { color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 12, fontSize: 12, lineHeight: 18 },
  clubBox: { marginBottom: 8 },
  clubLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "700", marginBottom: 6 },
  clubChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipT: { color: "white", fontWeight: "800", fontSize: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginBottom: 10,
  },
  btn: {
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
