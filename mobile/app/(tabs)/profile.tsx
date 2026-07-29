import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, wakeServer } from "../../src/api/client";
import { APP_VERSION, mediaUrl } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtMoney, statusLabel } from "../../src/theme";

type Child = {
  id: number;
  full_name: string;
  birth_date?: string;
  status: string;
  legacy_number?: number;
  blood_type?: string;
  photo_path?: string;
  category_code?: string;
};

type Me = {
  id: number;
  email?: string;
  phone?: string;
  full_name: string;
  full_name_ar?: string;
  role: string;
  locale?: string;
};

type Inst = {
  id: number;
  athlete_id: number;
  amount: number;
  amount_paid: number;
  status: string;
};

type TeamWithCoaches = {
  id: number;
  name: string;
  category_code?: string;
  coaches: { user_id: number; coach_name?: string; role_label?: string }[];
};

export default function ProfileScreen() {
  const { fullName, role, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [installments, setInstallments] = useState<Inst[]>([]);
  const [myTeams, setMyTeams] = useState<string[]>([]);
  const [health, setHealth] = useState<string>("");
  const [msg, setMsg] = useState("");
  const isParent = role === "parent";
  const isCoach = role === "coach" || role === "admin" || role === "staff" || role === "direction";

  const load = useCallback(async () => {
    let profile: Me | null = null;
    try {
      profile = await api<Me>("/api/v1/auth/me");
      setMe(profile);
    } catch {
      setMe(null);
    }
    const kids = await api<Child[]>("/api/v1/mobile/children").catch(() => [] as Child[]);
    setChildren(kids);
    const inst = await api<Inst[]>("/api/v1/installments?limit=200").catch(() => [] as Inst[]);
    setInstallments(inst);
    if (isCoach) {
      const rows = await api<TeamWithCoaches[]>("/api/v1/teams/coaches").catch(() => [] as TeamWithCoaches[]);
      const uid = profile?.id;
      const names = rows
        .filter((t) => (role === "coach" && uid ? t.coaches.some((c) => c.user_id === uid) : true))
        .map((t) => `${t.name}${t.category_code ? ` (${t.category_code})` : ""}`);
      setMyTeams(names);
    }
  }, [isCoach, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onWake() {
    setMsg("Réveil du serveur…");
    try {
      await wakeServer();
      const h = await api<{ version?: string; status?: string }>("/health");
      setHealth(h.version ? `API v${h.version}` : h.status || "ok");
      setMsg("Serveur réveillé");
    } catch {
      setMsg("Réveil impossible — réessayez");
    }
  }

  function unpaidFor(athleteId: number) {
    return installments
      .filter((i) => i.athlete_id === athleteId && i.status !== "paid")
      .reduce((s, i) => s + Math.max(0, Number(i.amount) - Number(i.amount_paid)), 0);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.title}>{me?.full_name || fullName}</Text>
        {!!me?.full_name_ar && <Text style={styles.ar}>{me.full_name_ar}</Text>}
        <Text style={styles.muted}>Rôle : {statusLabel(role || "") || role}</Text>
        {!!me?.phone && <Text style={styles.line}>Tél. : {me.phone}</Text>}
        {!!me?.email && <Text style={styles.line}>Email : {me.email}</Text>}
        {!!health && <Text style={styles.meta}>{health}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Accès application</Text>
        {isParent && (
          <Text style={styles.muted}>
            Enfants liés · convocations · agenda · cotisations · annonces · messages au club
          </Text>
        )}
        {role === "coach" && (
          <Text style={styles.muted}>
            Créer des séances · présences · convocations · annonces · messages
          </Text>
        )}
        {(role === "admin" || role === "staff" || role === "direction") && (
          <Text style={styles.muted}>
            Gestion complète mobile : agenda, encaissements, annonces, messages — le web reste le back-office complet
          </Text>
        )}
      </View>

      {(isParent || children.length > 0) && (
        <>
          <Text style={styles.section}>Mes enfants / أبنائي ({children.length})</Text>
          {children.map((c) => {
            const photo = mediaUrl(c.photo_path);
            const unpaid = unpaidFor(c.id);
            return (
              <View key={c.id} style={styles.childCard}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPh}>
                    <Text>?</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{c.full_name}</Text>
                  <Text style={styles.muted}>
                    {c.category_code || "—"} · #{c.legacy_number ?? c.id} · {c.birth_date ?? "—"}
                  </Text>
                  <Text style={styles.muted}>
                    {statusLabel(c.status)}
                    {c.blood_type ? ` · Sang ${c.blood_type}` : ""}
                  </Text>
                  {unpaid > 0 ? (
                    <Text style={styles.unpaid}>Impayés : {fmtMoney(unpaid)}</Text>
                  ) : (
                    <Text style={styles.paid}>Cotisations à jour</Text>
                  )}
                </View>
              </View>
            );
          })}
          {!children.length && isParent && (
            <Text style={styles.muted}>
              Aucun enfant lié. Le club doit enregistrer votre téléphone à l’inscription.
            </Text>
          )}
        </>
      )}

      {isCoach && (
        <View style={styles.card}>
          <Text style={styles.section}>Équipes</Text>
          {myTeams.map((t) => (
            <Text key={t} style={styles.line}>
              · {t}
            </Text>
          ))}
          {!myTeams.length && <Text style={styles.muted}>Aucune équipe affectée</Text>}
        </View>
      )}

      <Pressable style={styles.secondary} onPress={() => router.push("/change-password")}>
        <Text style={styles.secondaryT}>Changer le mot de passe</Text>
      </Pressable>

      <Pressable style={styles.secondary} onPress={onWake}>
        <Text style={styles.secondaryT}>Actualiser / Réveiller le serveur</Text>
      </Pressable>
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      <Pressable style={styles.logout} onPress={() => logout()}>
        <Text style={styles.logoutT}>Déconnexion</Text>
      </Pressable>
      <Text style={styles.version}>WRBH Club · version {APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  section: { fontWeight: "800", color: colors.blue, fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4 },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: { width: 56, height: 56, borderRadius: 14 },
  avatarPh: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#dbe3f5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", color: colors.navy, fontSize: 16 },
  ar: { color: colors.muted },
  muted: { color: colors.muted, marginTop: 4, lineHeight: 19 },
  line: { color: "#334155", marginTop: 4, fontSize: 14 },
  meta: { color: "#94a3b8", marginTop: 6, fontSize: 12 },
  unpaid: { marginTop: 6, color: "#a16207", fontWeight: "800" },
  paid: { marginTop: 6, color: colors.success, fontWeight: "700" },
  secondary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryT: { color: colors.blue, fontWeight: "800" },
  logout: { backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  logoutT: { color: "white", fontWeight: "800" },
  version: { color: "#64748b", textAlign: "center", fontSize: 12, marginTop: 4 },
  ok: { color: colors.success, fontWeight: "700", textAlign: "center" },
});
