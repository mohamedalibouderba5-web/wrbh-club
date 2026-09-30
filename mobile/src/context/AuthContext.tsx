import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as apiLogin, logout as apiLogout } from "../api/client";
import { registerPushToken } from "../push";

type Auth = {
  ready: boolean;
  token: string | null;
  role: string | null;
  fullName: string | null;
  clubSlug: string | null;
  mustChangePassword: boolean;
  login: (u: string, p: string, clubSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearMustChangePassword: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [clubSlug, setClubSlug] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, r, n, m, c] = await AsyncStorage.multiGet([
        "wrbh_token",
        "wrbh_role",
        "wrbh_name",
        "wrbh_must_pwd",
        "wrbh_club_slug",
      ]);
      setToken(t[1]);
      setRole(r[1]);
      setFullName(n[1]);
      setMustChangePassword(m[1] === "1");
      setClubSlug(c[1]);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready || !token || mustChangePassword) return;
    void registerPushToken();
  }, [ready, token, mustChangePassword]);

  const value = useMemo<Auth>(
    () => ({
      ready,
      token,
      role,
      fullName,
      clubSlug,
      mustChangePassword,
      async login(u, p, slug) {
        const data = await apiLogin(u, p, slug);
        setToken(data.access_token);
        setRole(data.role);
        setFullName(data.full_name);
        setMustChangePassword(!!data.must_change_password);
        if (slug?.trim()) setClubSlug(slug.trim());
      },
      async logout() {
        await apiLogout();
        setToken(null);
        setRole(null);
        setFullName(null);
        setMustChangePassword(false);
        // keep club slug for next login convenience
      },
      async clearMustChangePassword() {
        await AsyncStorage.setItem("wrbh_must_pwd", "0");
        setMustChangePassword(false);
      },
    }),
    [ready, token, role, fullName, clubSlug, mustChangePassword],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider required");
  return v;
}
