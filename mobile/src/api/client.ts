import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

const TIMEOUT_MS = 45_000;

export async function getToken() {
  return AsyncStorage.getItem("wrbh_token");
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Délai dépassé — vérifiez Internet / réveillez le serveur");
    }
    throw new Error("Pas de connexion réseau — réessayez");
  } finally {
    clearTimeout(timer);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (e) {
    throw e instanceof Error ? e : new Error("Erreur réseau");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg =
      typeof err.detail === "string"
        ? err.detail
        : Array.isArray(err.detail)
          ? err.detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" · ") || "Erreur API"
          : "Erreur API";
    if (res.status === 401 && token) {
      await logout();
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Réponse serveur invalide");
  }
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password });
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw e instanceof Error ? e : new Error("Erreur réseau");
  }
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

/** Réveil serveur sans exiger un JWT (ne bloque pas l’écran login). */
export async function wakeServer() {
  try {
    await fetchWithTimeout(
      `${API_BASE}/api/v1/system/wake`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      60_000,
    );
  } catch {
    /* cold start Render : on ignore */
  }
}

export { API_BASE };
