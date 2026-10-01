import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; webUrl?: string };

/** URL de l'API : variable de build EXPO_PUBLIC_API_URL, sinon extra.apiUrl de app.json. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "http://46.224.38.201:8081").replace(
  /\/+$/,
  "",
);

/** Site web (offres, guide, pilote). */
export const WEB_BASE = (
  process.env.EXPO_PUBLIC_WEB_URL ||
  extra.webUrl ||
  API_BASE.replace(":8081", ":8080").replace("/api", "") ||
  "http://46.224.38.201:8080"
).replace(/\/+$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
export const APP_VERSION_CODE = Number(
  (Constants.expoConfig?.android as { versionCode?: number } | undefined)?.versionCode ?? 0,
);

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
