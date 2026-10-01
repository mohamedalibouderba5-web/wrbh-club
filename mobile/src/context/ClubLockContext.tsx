import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { colors } from "../theme";

type ClubMeta = {
  status?: string;
  trial_expired?: boolean;
  trial_days_left?: number | null;
  plan?: string;
  name?: string;
};

type ClubLock = {
  readOnly: boolean;
  reason: "suspended" | "trial" | null;
  message: string | null;
  club: ClubMeta | null;
  refresh: () => void;
};

const Ctx = createContext<ClubLock | null>(null);

export function ClubLockProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [club, setClub] = useState<ClubMeta | null>(null);

  const refresh = () => {
    if (!token) {
      setClub(null);
      return;
    }
    api<{ club?: ClubMeta }>("/api/v1/bootstrap")
      .then((b) => setClub(b.club || null))
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<ClubLock>(() => {
    const suspended = (club?.status || "").toLowerCase() === "suspended";
    const trial = !!club?.trial_expired;
    const readOnly = suspended || trial;
    let reason: ClubLock["reason"] = null;
    let message: string | null = null;
    if (suspended) {
      reason = "suspended";
      message = "Club suspendu — lecture seule (export autorisé)";
    } else if (trial) {
      reason = "trial";
      message = "Essai terminé — lecture seule. Passez à un abonnement.";
    }
    return { readOnly, reason, message, club, refresh };
  }, [club]);

  return (
    <Ctx.Provider value={value}>
      {value.readOnly && value.message ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{value.message}</Text>
          <Pressable onPress={value.refresh} hitSlop={8}>
            <Text style={styles.refresh}>↻</Text>
          </Pressable>
        </View>
      ) : null}
      {children}
    </Ctx.Provider>
  );
}

export function useClubLock(): ClubLock {
  const v = useContext(Ctx);
  if (!v) {
    return {
      readOnly: false,
      reason: null,
      message: null,
      club: null,
      refresh: () => undefined,
    };
  }
  return v;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#7c2d12",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerText: { color: "#fff7ed", fontWeight: "800", flex: 1, fontSize: 13 },
  refresh: { color: colors.gold, fontWeight: "800", fontSize: 16 },
});
