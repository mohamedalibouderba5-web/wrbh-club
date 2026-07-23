import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { health, wakeServer } from "../api/client";
import { useI18n } from "../i18n";

export function AppLayout() {
  const { fullName, role, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [wakeMsg, setWakeMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const links = [
    { to: "/", label: t("dashboard"), short: lang === "ar" ? "رئيسية" : "Accueil" },
    { to: "/athletes", label: `${t("athletes")} / اللاعبون`, short: lang === "ar" ? "لاعبون" : "Joueurs" },
    { to: "/registrations", label: t("registrations"), short: lang === "ar" ? "تسجيل" : "Inscript." },
    { to: "/agenda", label: t("agenda"), short: lang === "ar" ? "جدول" : "Agenda" },
    { to: "/finance", label: t("finance"), short: lang === "ar" ? "مالية" : "Finance" },
    { to: "/inventory", label: t("inventory"), short: lang === "ar" ? "عتاد" : "Matériel" },
    { to: "/announcements", label: t("announcements"), short: lang === "ar" ? "إعلان" : "Annonces" },
    { to: "/download", label: t("download"), short: lang === "ar" ? "تطبيق" : "App" },
  ];

  const bottom = [
    links[0],
    links[1],
    links[2],
    links[3],
    links[7],
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
    <div className={`app-shell ${menuOpen ? "menu-open" : ""}`}>
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
        <div className="sidebar-user">
          <div>{fullName}</div>
          <div className="badge" style={{ marginTop: 6 }}>{role}</div>
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
            <button className="accent wake-btn" onClick={onWake}>{t("wake")}</button>
            {wakeMsg && <span className="wake-msg">{wakeMsg}</span>}
          </div>
        </div>
        <div className="page-content">
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
