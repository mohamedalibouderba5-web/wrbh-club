import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, type TokenPayload } from "./api/client";

type AuthState = {
  token: string | null;
  role: string | null;
  fullName: string | null;
  mustChangePassword: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  clearMustChangePassword: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("wrbh_token"));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("wrbh_role"));
  const [fullName, setFullName] = useState<string | null>(() => localStorage.getItem("wrbh_name"));
  const [mustChangePassword, setMustChangePassword] = useState(
    () => localStorage.getItem("wrbh_must_pwd") === "1",
  );

  const value = useMemo<AuthState>(
    () => ({
      token,
      role,
      fullName,
      mustChangePassword,
      async login(username, password) {
        const data: TokenPayload = await apiLogin(username, password);
        localStorage.setItem("wrbh_token", data.access_token);
        localStorage.setItem("wrbh_role", data.role);
        localStorage.setItem("wrbh_name", data.full_name);
        const must = !!data.must_change_password;
        localStorage.setItem("wrbh_must_pwd", must ? "1" : "0");
        setToken(data.access_token);
        setRole(data.role);
        setFullName(data.full_name);
        setMustChangePassword(must);
      },
      logout() {
        localStorage.removeItem("wrbh_token");
        localStorage.removeItem("wrbh_role");
        localStorage.removeItem("wrbh_name");
        localStorage.removeItem("wrbh_must_pwd");
        setToken(null);
        setRole(null);
        setFullName(null);
        setMustChangePassword(false);
      },
      clearMustChangePassword() {
        localStorage.setItem("wrbh_must_pwd", "0");
        setMustChangePassword(false);
      },
    }),
    [token, role, fullName, mustChangePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider manquant");
  return ctx;
}
