import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth";
import { health, prefetchHotPaths, wakeServer } from "../api/client";
import { useI18n } from "../i18n";
import { useAppUpdate } from "../pwa";
import { countPendingRegistrations } from "../offline/registrationQueue";
import { startOfflineSyncListeners, syncPendingRegistrations } from "../offline/sync";
import { ChangePasswordGate } from "../components/ChangePasswordGate";
import { Toaster } from "../components/Toast";

export function AppLayout() {
  const { fullName, role, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [wakeMsg, setWakeMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const location = useLocation();
  const { updateReady, checking, checkForUpdate, applyUpdate } = useAppUpdate();

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await countPendingRegistrations());
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    void refreshPendingCount();
    const stop = startOfflineSyncListeners();
    const onQueue = () => void refreshPendingCount();
    window.addEventListener("wrbh:offline-queue", onQueue);
    window.addEventListener("wrbh:offline-synced", onQueue);
    return () => {
      stop();
      window.removeEventListener("wrbh:offline-queue", onQueue);
      window.removeEventListener("wrbh:offline-synced", onQueue);
    };
  }, [refreshPendingCount]);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (!cancelled) {
        wakeServer()
          .then(() => {
            prefetchHotPaths();
            void syncPendingRegistrations();
          })
          .catch(() => undefined);
      }
    };
    ping();
    prefetchHotPaths();
    const id = window.setInterval(ping, 4 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        ping();
        prefetchHotPaths();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const links = [
    { to: "/", label: t("dashboard"), short: lang === "ar" ? "رئيسية" : "Accueil", roles: null as string[] | null },
    { to: "/athletes", label: t("athletes"), short: lang === "ar" ? "لاعبون" : "Joueurs", roles: ["admin", "direction", "staff", "coach"] },
    { to: "/registrations", label: t("registrations"), short: lang === "ar" ? "تسجيل" : "Inscript.", roles: ["admin", "direction", "staff", "parent"] },
    { to: "/agenda", label: t("agenda"), short: lang === "ar" ? "جدول" : "Agenda", roles: null },
    { to: "/finance", label: t("finance"), short: lang === "ar" ? "مالية" : "Finance", roles: ["admin", "direction", "staff"] },
    { to: "/inventory", label: t("inventory"), short: lang === "ar" ? "عتاد" : "Matériel", roles: ["admin", "direction", "staff"] },
    { to: "/announcements", label: t("announcements"), short: lang === "ar" ? "إعلان" : "Annonces", roles: null },
    { to: "/download", label: t("download"), short: lang === "ar" ? "تطبيق" : "App", roles: null },
  ].filter((l) => !l.roles || (role && l.roles.includes(role)));

  const bottom = [links[0], links[1], links[2], links[3], links[links.length - 1]].filter(Boolean);

  async function onWake() {
    setWakeMsg("…");
    try {
      await wakeServer();
      const h = await health();
      setWakeMsg(`OK — ${h.environment || "?"} · ${h.time}`);
      window.dispatchEvent(new CustomEvent("wrbh:server-awake"));
      const r = await syncPendingRegistrations();
      if (r.synced) setWakeMsg((m) => `${m} · sync ${r.synced}`);
      await checkForUpdate();
    } catch {
      setWakeMsg("Échec — réessayez");
    }
  }

  async function onSyncBanner() {
    setSyncBusy(true);
    try {
      await wakeServer().catch(() => undefined);
      await syncPendingRegistrations();
      await refreshPendingCount();
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className={`app-shell ${menuOpen ? "menu-open" : ""}`}>
      <ChangePasswordGate />
      <Toaster />
      {menuOpen && <button type="button" className="drawer-backdrop" aria-label="Close" onClick={() => setMenuOpen(false)} />}

      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="WRBH" />
          <div>
            <h1>{t("brand")}</h1>
            <small>الوداد الرياضي لبلدية حمادي</small>
          </div>
          <button type="button" className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="lang-switch">
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
            FR
          </button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
            عربي
          </button>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div>{fullName}</div>
          <div className="badge" style={{ marginTop: 6 }}>
            {role}
          </div>
          <button className="secondary" style={{ marginTop: 12, width: "100%" }} onClick={() => checkForUpdate()}>
            {checking ? t("checkingUpdate") : t("checkUpdate")}
          </button>
          <button className="secondary" style={{ marginTop: 12, width: "100%" }} onClick={logout}>
            {t("logout")}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button type="button" className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
            ☰
          </button>
          <div className="topbar-titles">
            <h2 style={{ margin: 0 }}>{t("manage")}</h2>
            <div className="topbar-sub">{t("season")}</div>
          </div>
          <div className="wake-bar">
            <button className="accent wake-btn" onClick={onWake}>
              {t("wake")}
            </button>
            {wakeMsg && <span className="wake-msg">{wakeMsg}</span>}
          </div>
        </div>
        <div className="page-content">
          {updateReady && (
            <div className="update-banner">
              <span>{t("updateAvailable")}</span>
              <button type="button" onClick={applyUpdate}>
                {t("updateNow")}
              </button>
            </div>
          )}
          {(!online || pendingCount > 0) && (
            <div className={`offline-banner ${online ? "pending" : "offline"}`}>
              <span>
                {!online
                  ? "Hors ligne — les inscriptions sont sauvegardées sur cet appareil"
                  : `${pendingCount} inscription(s) en attente de synchronisation`}
              </span>
              {pendingCount > 0 && online && (
                <button type="button" disabled={syncBusy} onClick={() => void onSyncBanner()}>
                  {syncBusy ? "…" : "Synchroniser"}
                </button>
              )}
            </div>
          )}
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigation mobile">
        {bottom.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <span>{l.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
