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

function formatApiError(status: number, detail: unknown, fallback: string): string {
  if (status === 429) {
    return "Trop de tentatives — réessayez dans quelques minutes (réseau partagé).";
  }
  if (status === 403) {
    const raw =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" · ")
          : "";
    if (/suspendu/i.test(raw)) {
      return "Club suspendu — lecture seule. Contactez le support Nadi Connect.";
    }
    if (/essai/i.test(raw)) {
      return "Essai terminé — lecture seule. Passez à un abonnement pour continuer.";
    }
    return raw || "Accès refusé (403).";
  }
  if (status >= 500) {
    const raw =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" · ")
          : "";
    if (raw && !/internal server error|erreur serveur interne/i.test(raw)) return raw;
    return "Service temporairement indisponible — réessayez dans un instant.";
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const joined = detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" · ");
    if (joined) return joined;
  }
  return fallback;
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
    const msg = formatApiError(res.status, err.detail, "Erreur API");
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

export async function login(username: string, password: string, clubSlug?: string) {
  const body = new URLSearchParams({ username, password });
  if (clubSlug?.trim()) body.set("club_slug", clubSlug.trim());
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Identifiants incorrects" }));
    throw new Error(formatApiError(res.status, err.detail, "Identifiants incorrects"));
  }
  const data = await res.json();
  await AsyncStorage.setItem("wrbh_token", data.access_token);
  await AsyncStorage.setItem("wrbh_role", data.role);
  await AsyncStorage.setItem("wrbh_name", data.full_name);
  await AsyncStorage.setItem("wrbh_must_pwd", data.must_change_password ? "1" : "0");
  if (clubSlug?.trim()) await AsyncStorage.setItem("wrbh_club_slug", clubSlug.trim());
  return data;
}

export async function uploadPhoto(file: { uri: string; name: string; type: string }, athleteId?: number) {
  const token = await getToken();
  const fd = new FormData();
  // React Native FormData file shape
  fd.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const qs = athleteId ? `?athlete_id=${athleteId}` : "";
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/uploads/photo${qs}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Upload photo échoué");
  }
  return (await res.json()) as { path: string; url: string };
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
