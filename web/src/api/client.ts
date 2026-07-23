const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type TokenPayload = {
  access_token: string;
  role: string;
  user_id: number;
  full_name: string;
};

function authHeader(): HeadersInit {
  const token = localStorage.getItem("wrbh_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
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

export async function api<T>(path: string, options: RequestInit = {}, retries = 1): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.body instanceof URLSearchParams || isForm ? {} : { "Content-Type": "application/json" }),
          ...authHeader(),
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }
      if (res.status === 204) return undefined as T;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        throw new Error(
          API_BASE
            ? "Réponse non-JSON de l'API"
            : "VITE_API_URL manquant : les appels tombent sur le site statique. Configurer l'URL API.",
        );
      }
      return res.json();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        try {
          await wakeServer();
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
    }
  }
  throw lastErr || new Error("Erreur réseau");
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
  return res.json();
}

export async function wakeServer() {
  return api<{ status: string; woken_at: string }>("/api/v1/system/wake", { method: "POST" }, 0);
}

export async function health() {
  return api<{ status: string; time: string; environment?: string; warnings?: string[] }>(
    "/api/v1/system/health",
    {},
    0,
  );
}

/** Charge plusieurs endpoints sans tout faire échouer si l'un plante. */
export async function loadAllSettled<T extends unknown[]>(
  loaders: { [K in keyof T]: () => Promise<T[K]> },
): Promise<{ data: { [K in keyof T]: T[K] | null }; errors: string[] }> {
  const results = await Promise.allSettled(loaders.map((fn) => fn()));
  const data = results.map((r) => (r.status === "fulfilled" ? r.value : null)) as { [K in keyof T]: T[K] | null };
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
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
