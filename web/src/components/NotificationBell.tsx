/** Centre de notifications navigateur (Chrome) + son + polling. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n";

type NotifRow = {
  id: number;
  title: string;
  body: string;
  kind?: string;
  link?: string | null;
  is_read: boolean;
  created_at?: string;
};

const SEEN_KEY = "nadi_notif_seen_ids";

function loadSeen(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set((JSON.parse(raw) as number[]).slice(-200));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<number>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* ignore */
  }
}

/** Bip court (Web Audio) — pas besoin de fichier MP3. */
function playNotifSound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    /* ignore */
  }
}

async function ensureBrowserPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function showBrowserNotif(n: NotifRow) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const note = new Notification(n.title, {
      body: n.body,
      icon: "/logo.png",
      tag: `nadi-${n.id}`,
      silent: false,
    });
    note.onclick = () => {
      window.focus();
      if (n.link) window.location.href = n.link;
      note.close();
    };
  } catch {
    /* ignore */
  }
}

export function NotificationBell() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [perm, setPerm] = useState<string>("default");
  const seenRef = useRef<Set<number>>(loadSeen());
  const boxRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api<NotifRow[]>("/api/v1/notifications?limit=30"),
        api<{ count: number }>("/api/v1/notifications/unread-count").catch(() => ({ count: 0 })),
      ]);
      const prev = seenRef.current;
      const fresh = list.filter((n) => !n.is_read && !prev.has(n.id));
      if (fresh.length) {
        playNotifSound();
        for (const n of fresh.slice(0, 3)) {
          showBrowserNotif(n);
          prev.add(n.id);
        }
        saveSeen(prev);
      }
      setItems(list);
      setUnread(count.count ?? list.filter((n) => !n.is_read).length);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void ensureBrowserPermission().then((p) => setPerm(p));
    void refresh();
    const t = window.setInterval(() => void refresh(), 25000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function enableChrome() {
    const p = await ensureBrowserPermission();
    setPerm(p);
    if (p === "granted") playNotifSound();
  }

  async function markAll() {
    await api("/api/v1/notifications/read-all", { method: "POST", body: "{}" }).catch(() => undefined);
    await refresh();
  }

  async function markOne(id: number) {
    await api(`/api/v1/notifications/${id}/read`, { method: "POST", body: "{}" }).catch(() => undefined);
    await refresh();
  }

  return (
    <div className="notif-bell" ref={boxRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label={ar ? "الإشعارات" : "Notifications"}
        onClick={() => {
          setOpen((v) => !v);
          void refresh();
        }}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={ar ? "مركز الإشعارات" : "Centre de notifications"}>
          <div className="notif-panel-head">
            <strong>{ar ? "الإشعارات" : "Notifications"}</strong>
            <div className="notif-panel-actions">
              {perm !== "granted" && perm !== "unsupported" && (
                <button type="button" className="secondary" onClick={() => void enableChrome()}>
                  {ar ? "تفعيل Chrome" : "Activer Chrome"}
                </button>
              )}
              <button type="button" className="secondary" onClick={() => void markAll()}>
                {ar ? "قراءة الكل" : "Tout lu"}
              </button>
            </div>
          </div>
          <ul className="notif-list">
            {!items.length && <li className="muted">{ar ? "لا إشعارات" : "Aucune notification"}</li>}
            {items.map((n) => (
              <li key={n.id} className={n.is_read ? "read" : "unread"}>
                <button type="button" className="notif-item" onClick={() => void markOne(n.id)}>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-body">{n.body}</div>
                  {n.link && (
                    <Link to={n.link} className="notif-link" onClick={() => setOpen(false)}>
                      {ar ? "فتح" : "Ouvrir"}
                    </Link>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
