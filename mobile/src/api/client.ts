import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

export async function getToken() {
  return AsyncStorage.getItem("wrbh_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Erreur API");
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("Identifiants incorrects");
  const data = await res.json();
  await AsyncStorage.setItem("wrbh_token", data.access_token);
  await AsyncStorage.setItem("wrbh_role", data.role);
  await AsyncStorage.setItem("wrbh_name", data.full_name);
  await AsyncStorage.setItem("wrbh_must_pwd", data.must_change_password ? "1" : "0");
  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove(["wrbh_token", "wrbh_role", "wrbh_name", "wrbh_must_pwd"]);
}

export async function changePassword(current_password: string, new_password: string) {
  return api("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function wakeServer() {
  return api("/api/v1/system/wake", { method: "POST" });
}

export { API_BASE };
