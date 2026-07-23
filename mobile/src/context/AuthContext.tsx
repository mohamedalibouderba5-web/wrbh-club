import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as apiLogin, logout as apiLogout } from "../api/client";

type Auth = {
  ready: boolean;
  token: string | null;
  role: string | null;
  fullName: string | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, r, n] = await AsyncStorage.multiGet(["wrbh_token", "wrbh_role", "wrbh_name"]);
      setToken(t[1]);
      setRole(r[1]);
      setFullName(n[1]);
      setReady(true);
    })();
  }, []);

  const value = useMemo<Auth>(
    () => ({
      ready,
      token,
      role,
      fullName,
      async login(u, p) {
        const data = await apiLogin(u, p);
        setToken(data.access_token);
        setRole(data.role);
        setFullName(data.full_name);
      },
      async logout() {
        await apiLogout();
        setToken(null);
        setRole(null);
        setFullName(null);
      },
    }),
    [ready, token, role, fullName],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider required");
  return v;
}
