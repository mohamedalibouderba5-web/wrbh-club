import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth";
import { health, wakeServer } from "../api/client";

const links = [
  { to: "/", label: "Tableau de bord" },
  { to: "/athletes", label: "Athlètes / اللاعبون" },
  { to: "/registrations", label: "Inscriptions" },
  { to: "/agenda", label: "Agenda" },
  { to: "/finance", label: "Finance" },
  { to: "/inventory", label: "Matériel" },
  { to: "/announcements", label: "Annonces" },
  { to: "/download", label: "Télécharger l'app" },
];

export function AppLayout() {
  const { fullName, role, logout } = useAuth();
  const [wakeMsg, setWakeMsg] = useState("");

  async function onWake() {
    setWakeMsg("Réveil…");
    try {
      await wakeServer();
      const h = await health();
      setWakeMsg(`OK — ${h.time}`);
    } catch {
      setWakeMsg("Échec — réessayez");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="WRBH" />
          <div>
            <h1>WRBH Club</h1>
            <small>الوداد الرياضي لبلدية حمادي</small>
          </div>
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
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>Gestion du club</h2>
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Saison 2026/2027 · Football</div>
          </div>
          <div className="wake-bar">
            <button className="accent" onClick={onWake}>Actualiser / Réveiller le serveur</button>
            {wakeMsg && <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{wakeMsg}</span>}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
