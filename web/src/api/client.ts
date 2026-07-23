const API_BASE = import.meta.env.VITE_API_URL || "";

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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof URLSearchParams || isForm ? {} : { "Content-Type": "application/json" }),
      ...authHeader(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ")
          : "Erreur API";
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
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
  return api<{ status: string; woken_at: string }>("/api/v1/system/wake", { method: "POST" });
}

export async function health() {
  return api<{ status: string; time: string }>("/api/v1/system/health");
}
