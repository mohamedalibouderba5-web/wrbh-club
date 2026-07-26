/** Collecteur automatique d'erreurs (web) → POST /api/v1/feedback/events */
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type ReportPayload = {
  kind?: string;
  source?: string;
  severity?: string;
  target?: string;
  message: string;
  stack?: string;
  page_url?: string;
  meta?: Record<string, unknown>;
};

const queue: ReportPayload[] = [];
let flushTimer: number | null = null;
let installed = false;

function authHeader(): HeadersInit {
  const token = localStorage.getItem("wrbh_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sendOne(payload: ReportPayload) {
  try {
    await fetch(`${API_BASE}/api/v1/feedback/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        kind: payload.kind || "auto_error",
        source: payload.source || "web",
        severity: payload.severity || "error",
        target: payload.target || window.location.pathname,
        message: String(payload.message || "Erreur").slice(0, 4000),
        stack: payload.stack ? String(payload.stack).slice(0, 8000) : undefined,
        page_url: payload.page_url || window.location.href,
        meta: {
          ...(payload.meta || {}),
          lang: localStorage.getItem("wrbh_lang") || undefined,
          role: localStorage.getItem("wrbh_role") || undefined,
          online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
        },
      }),
      keepalive: true,
    });
  } catch {
    /* ne jamais boucler sur le collecteur */
  }
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const batch = queue.splice(0, 20);
    batch.forEach((p) => void sendOne(p));
  }, 400);
}

export function reportError(payload: ReportPayload) {
  const msg = String(payload.message || "");
  // Évite le bruit : session expirée déjà gérée par redirect login
  if (/token invalide|identifiants incorrects/i.test(msg)) return;
  queue.push(payload);
  if (queue.length > 50) queue.splice(0, queue.length - 50);
  scheduleFlush();
}

export function reportApiFailure(path: string, status: number, detail: string) {
  if (status === 401) return;
  reportError({
    kind: "api_error",
    severity: status >= 500 ? "critical" : "error",
    target: path,
    message: `HTTP ${status}: ${detail}`,
    meta: { status, path },
  });
}

export function installErrorCollector() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    reportError({
      kind: "auto_error",
      severity: "error",
      target: window.location.pathname,
      message: ev.message || "window.onerror",
      stack: ev.error?.stack,
      meta: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "unhandledrejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportError({
      kind: "auto_error",
      severity: "error",
      target: window.location.pathname,
      message,
      stack,
    });
  });
}
