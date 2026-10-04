import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { useI18n } from "../src/context/I18nContext";
import { API_BASE, WEB_BASE } from "../src/config";
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
  const { t, lang, setLang } = useI18n();
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
      const slug = clubSlug.trim();
      const user = username.trim();
      // Superadmin plateforme : slug optionnel (compte hors club)
      const isPlatformHint = /platform@/i.test(user);
      if (!slug && !isPlatformHint) {
        setError("Code club (slug) requis");
        return;
      }
      await wakeServer().catch(() => undefined);
      if (slug) await AsyncStorage.setItem("wrbh_club_slug", slug);
      await login(user, password, slug || undefined);
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
  const productName = "Nadi Connect";
  const clubTitle = brand?.name || "";
  const subtitle = brand?.name_ar || "نادي · تسيير ومتابعة النوادي الرياضية في الجزائر";
  // Produit = toujours logo Nadi Connect (logo club = plus tard, hors chrome produit)

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: primary }]} keyboardShouldPersistTaps="handled">
      <Image source={require("../assets/logo.png")} style={[styles.logo, { borderColor: accent }]} />
      <Text style={styles.title}>{productName}</Text>
      <Text style={[styles.ar, { color: accent }]}>{subtitle}</Text>
      {!!clubTitle && (
        <Text style={styles.sub}>
          {clubTitle}
          {brand?.acronym ? ` · ${brand.acronym}` : ""}
          {brand?.sport ? ` · ${statusLabel(brand.sport) || brand.sport}` : ""}
        </Text>
      )}
      {!clubTitle && <Text style={styles.sub}>Connexion multi-club · parent ☎ / staff email</Text>}

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
          placeholder="Code club (slug) — requis sauf plateforme"
          placeholderTextColor="#8a93a8"
          autoCapitalize="none"
          value={clubSlug}
          onChangeText={setClubSlug}
          editable={!loading}
        />
      )}

      <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginBottom: 4, alignSelf: "stretch" }}>
        Plateforme : platform@… sans code club
      </Text>
      <TextInput
        style={styles.input}
        placeholder={t("loginPhone")}
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
        placeholder={t("password")}
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
        disabled={
          loading ||
          !username.trim() ||
          !password ||
          (!clubSlug.trim() && !/platform@/i.test(username))
        }
      >
        {loading ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.btnText}>{t("signIn")}</Text>}
      </Pressable>
      <View style={styles.langRow}>
        <Pressable style={[styles.langChip, lang === "fr" && styles.langOn]} onPress={() => setLang("fr")}>
          <Text style={[styles.langT, lang === "fr" && styles.langTOn]}>{t("langFr")}</Text>
        </Pressable>
        <Pressable style={[styles.langChip, lang === "ar" && styles.langOn]} onPress={() => setLang("ar")}>
          <Text style={[styles.langT, lang === "ar" && styles.langTOn]}>{t("langAr")}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.wake} onPress={onWake}>
        <Text style={styles.wakeText}>{t("wake")}</Text>
      </Pressable>
      {!!wakeMsg && <Text style={styles.sub}>{wakeMsg}</Text>}
      <Pressable style={styles.wake} onPress={() => router.push("/onboard")}>
        <Text style={[styles.wakeText, { color: accent }]}>{t("createAccount")}</Text>
      </Pressable>
      <Pressable style={styles.wake} onPress={() => void Linking.openURL(`${WEB_BASE}/pricing`)}>
        <Text style={styles.wakeText}>{t("pricing")}</Text>
      </Pressable>
      <Pressable style={styles.wake} onPress={() => void Linking.openURL(`${WEB_BASE}/guide`)}>
        <Text style={styles.wakeText}>{t("guide")}</Text>
      </Pressable>
      <Pressable style={styles.wake} onPress={() => void Linking.openURL(`${WEB_BASE}/pilote`)}>
        <Text style={styles.wakeText}>Devenir pilote</Text>
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
  langRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 14 },
  langChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  langOn: { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "#fff" },
  langT: { color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 13 },
  langTOn: { color: "#fff" },
  error: { color: "#ffb4b4", textAlign: "center", marginBottom: 8 },
});
