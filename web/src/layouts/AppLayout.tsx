import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth";
import { health, wakeServer } from "../api/client";
import { useI18n } from "../i18n";

export function AppLayout() {
  const { fullName, role, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [wakeMsg, setWakeMsg] = useState("");

  const links = [
    { to: "/", label: t("dashboard") },
    { to: "/athletes", label: `${t("athletes")} / اللاعبون` },
    { to: "/registrations", label: t("registrations") },
    { to: "/agenda", label: t("agenda") },
    { to: "/finance", label: t("finance") },
    { to: "/inventory", label: t("inventory") },
    { to: "/announcements", label: t("announcements") },
    { to: "/download", label: t("download") },
  ];

  async function onWake() {
    setWakeMsg("…");
    try {
      await wakeServer();
      const h = await health();
      setWakeMsg(`OK — ${h.time}`);
    } catch {
      setWakeMsg("Échec");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="WRBH" />
          <div>
            <h1>{t("brand")}</h1>
            <small>الوداد الرياضي لبلدية حمادي</small>
          </div>
        </div>
        <div className="lang-switch">
          <button type="button" className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>عربي</button>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto", fontSize: "0.85rem", opacity: 0.85 }}>
          <div>{fullName}</div>
          <div className="badge" style={{ marginTop: 6 }}>{role}</div>
          <button className="secondary" style={{ marginTop: 12, width: "100%" }} onClick={logout}>
            {t("logout")}
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>{t("manage")}</h2>
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t("season")}</div>
          </div>
          <div className="wake-bar">
            <button className="accent" onClick={onWake}>{t("wake")}</button>
            {wakeMsg && <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{wakeMsg}</span>}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
