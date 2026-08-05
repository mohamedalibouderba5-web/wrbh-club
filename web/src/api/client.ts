import { reportApiFailure } from "../feedback/collector";

/** Client API rapide : mémoire + sessionStorage, stale-while-revalidate. */
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type TokenPayload = {
  access_token: string;
  role: string;
  user_id: number;
  full_name: string;
  must_change_password?: boolean;
};

type CacheEntry = { at: number; data: unknown };

const mem = new Map<string, CacheEntry>();
const SS_PREFIX = "wrbh_c:";
const AUTH_KEYS = ["wrbh_token", "wrbh_role", "wrbh_name", "wrbh_must_pwd"] as const;

/** Efface la session locale et renvoie au login (évite « Token invalide » en boucle). */
export function clearSessionAndRedirect(reason: "session" | "expired" = "session") {
  for (const k of AUTH_KEYS) localStorage.removeItem(k);
  invalidateApiCache();
  const path = window.location.pathname || "/";
  if (path.startsWith("/login") || path.startsWith("/install") || path.startsWith("/download")) return;
  const q = reason === "expired" ? "expired=1" : "session=1";
  window.location.assign(`/login?${q}`);
}

function authHeader(): HeadersInit {
  const token = localStorage.getItem("wrbh_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  let url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  // Fallback auth pour chemins non signés (img ne peut pas envoyer Bearer)
  if (url.includes("/media/") && !url.includes("sig=") && !url.includes("access_token=")) {
    const token = localStorage.getItem("wrbh_token");
    if (token) {
      url += `${url.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
    }
  }
  return url;
}

async function parseError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
  }
  return "Erreur API";
}

class HttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function readCache<T>(key: string): CacheEntry | null {
  const m = mem.get(key);
  if (m) return m;
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown) {
  const entry: CacheEntry = { at: Date.now(), data };
  mem.set(key, entry);
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function invalidateApiCache(prefix = "") {
  for (const k of [...mem.keys()]) {
    if (!prefix || k.includes(prefix)) mem.delete(k);
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SS_PREFIX) && (!prefix || k.includes(prefix))) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

async function rawFetch<T>(path: string, options: RequestInit = {}, retries = 0): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutMs = path.includes("/system/wake") || path.includes("/system/health") ? 45_000 : 25_000;
      const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : 0;
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controller?.signal,
        headers: {
          ...(options.body instanceof URLSearchParams || isForm ? {} : { "Content-Type": "application/json" }),
          ...authHeader(),
          ...(options.headers || {}),
        },
      });
      if (timer) window.clearTimeout(timer);
      if (!res.ok) {
        const msg = await parseError(res);
        if (res.status === 401 && localStorage.getItem("wrbh_token")) {
          // JWT expiré / secret changé / token corrompu → reconnecter au lieu d'afficher l'erreur
          clearSessionAndRedirect(msg.toLowerCase().includes("expir") ? "expired" : "session");
        } else if (res.status !== 401) {
          reportApiFailure(path, res.status, msg);
        }
        throw new HttpError(msg);
      }
      if (res.status === 204) return undefined as T;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        throw new HttpError(
          API_BASE
            ? "Réponse non-JSON de l'API"
            : "VITE_API_URL manquant : les appels tombent sur le site statique. Configurer l'URL API.",
        );
      }
      return res.json();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (e instanceof HttpError) throw e;
      if (attempt < retries) {
        window.dispatchEvent(new CustomEvent("wrbh:cold-start", { detail: { attempt: attempt + 1 } }));
        const isWakePath = path.includes("/system/wake") || path.includes("/system/health");
        if (!isWakePath) {
          try {
            await wakeServer();
          } catch {
            /* ignore */
          }
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }
  window.dispatchEvent(new CustomEvent("wrbh:cold-start-failed"));
  throw lastErr || new Error("Erreur réseau — utilisez Actualiser / Réveiller le serveur");
}

/** GET/POST générique (mutations invalident le cache lié). */
export async function api<T>(path: string, options: RequestInit = {}, retries?: number): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  // Cold start Render : 2 retries réseau par défaut sur les lectures
  const retryCount = retries ?? (method === "GET" || method === "HEAD" ? 2 : 0);
  const data = await rawFetch<T>(path, options, retryCount);
  if (method !== "GET" && method !== "HEAD") {
    if (path.includes("/finance/settings") || path.includes("/ledger") || path.includes("/payments") || path.includes("/installments")) {
      invalidateApiCache("/finance/settings");
      invalidateApiCache("/dashboard");
      invalidateApiCache("/installments");
      invalidateApiCache("/ledger");
      invalidateApiCache("/payments");
    }
    if (path.includes("/athletes")) invalidateApiCache("/athletes");
    if (path.includes("/registrations")) invalidateApiCache("/registrations");
    if (path.includes("/inventory")) invalidateApiCache("/inventory");
    if (path.includes("/events") || path.includes("/teams") || path.includes("/users") || path.includes("/coaches")) {
      invalidateApiCache("/events");
      invalidateApiCache("/teams");
      invalidateApiCache("/coaches");
      invalidateApiCache("/auth/users");
    }
    if (path.includes("/stats") || path.includes("/athletes") || path.includes("/registrations")) {
      invalidateApiCache("/stats");
      invalidateApiCache("/bootstrap");
      invalidateApiCache("/dashboard");
    }
  }
  return data;
}

/**
 * GET ultra-rapide : renvoie le cache tout de suite (SWR), rafraîchit en fond.
 * ttlMs = durée où le cache est considéré "frais" (pas de refetch forcé).
 * Si ttlMs <= 0, force un refetch réseau (après avoir éventuellement invalidé).
 */
export async function apiGetFast<T>(
  path: string,
  opts?: { ttlMs?: number; onUpdate?: (data: T) => void },
): Promise<T> {
  const ttlMs = opts?.ttlMs ?? 45_000;
  const cached = readCache(path);
  const age = cached ? Date.now() - cached.at : Infinity;

  const refresh = async () => {
    const fresh = await rawFetch<T>(path);
    writeCache(path, fresh);
    opts?.onUpdate?.(fresh);
    return fresh;
  };

  if (ttlMs <= 0) {
    return refresh();
  }

  if (cached && age < ttlMs) {
    if (age > ttlMs / 2) void refresh().catch(() => undefined);
    return cached.data as T;
  }

  if (cached) {
    void refresh().catch(() => undefined);
    return cached.data as T;
  }

  return refresh();
}

export async function uploadPhoto(file: File, athleteId?: number, registrationId?: number) {
  const fd = new FormData();
  fd.append("file", file);
  const qs = new URLSearchParams();
  if (athleteId) qs.set("athlete_id", String(athleteId));
  if (registrationId) qs.set("registration_id", String(registrationId));
  const q = qs.toString() ? `?${qs}` : "";
  return api<{ path: string; url: string }>(`/api/v1/uploads/photo${q}`, { method: "POST", body: fd });
}

export async function login(username: string, password: string): Promise<TokenPayload> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Identifiants incorrects");
  invalidateApiCache();
  return res.json();
}

export async function wakeServer() {
  // Appel direct (sans rawFetch) pour éviter une boucle wake→retry→wake
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), 45_000) : 0;
  try {
    const res = await fetch(`${API_BASE}/api/v1/system/wake`, {
      method: "POST",
      signal: controller?.signal,
      headers: { "Content-Type": "application/json", ...authHeader() },
    });
    if (!res.ok) throw new Error("Wake failed");
    return (await res.json()) as { status: string; woken_at: string };
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

export async function health() {
  return rawFetch<{ status: string; time: string; environment?: string; warnings?: string[]; version?: string }>(
    "/api/v1/system/health",
    {},
    1,
  );
}

/** Précharge les données critiques en arrière-plan (après login / focus). */
export function prefetchHotPaths() {
  const paths = [
    "/api/v1/bootstrap",
    "/api/v1/categories",
    "/api/v1/athletes?limit=40&skip=0",
    "/api/v1/registrations?limit=40",
    "/api/v1/events?include_cancelled=true",
    "/api/v1/teams",
  ];
  paths.forEach((p) => {
    void apiGetFast(p, { ttlMs: 60_000 }).catch(() => undefined);
  });
}

export async function loadAllSettled<T extends unknown[]>(
  loaders: { [K in keyof T]: () => Promise<T[K]> },
): Promise<{ data: { [K in keyof T]: T[K] | null }; errors: string[] }> {
  const results = await Promise.allSettled(loaders.map((fn) => fn()));
  const data = results.map((r) => (r.status === "fulfilled" ? r.value : null)) as { [K in keyof T]: T[K] | null };
  const errors = [
    ...new Set(
      results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))),
    ),
  ];
  return { data, errors };
}

export function isDzMobile(raw: string): boolean {
  const d = raw.replace(/\D+/g, "");
  const n = d.startsWith("213") ? `0${d.slice(3)}` : d.length === 9 ? `0${d}` : d;
  return /^0[567]\d{8}$/.test(n);
}

export function formatDateFr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-DZ");
}
