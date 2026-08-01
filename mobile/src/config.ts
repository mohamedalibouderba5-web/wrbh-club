import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

/** URL de l'API : variable de build EXPO_PUBLIC_API_URL, sinon extra.apiUrl de app.json. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "https://wrbh-api.onrender.com").replace(
  /\/+$/,
  "",
);

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
export const APP_VERSION_CODE = Number(
  (Constants.expoConfig?.android as { versionCode?: number } | undefined)?.versionCode ?? 0,
);

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
