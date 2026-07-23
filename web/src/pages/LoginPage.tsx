import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { wakeServer } from "../api/client";

export function LoginPage() {
  const { token, login } = useAuth();
  const [username, setUsername] = useState("admin@wrbh.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await wakeServer().catch(() => undefined);
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <img src="/logo.png" alt="WRBH" />
        <h2>WRBH Club</h2>
        <div className="ar">الوداد الرياضي لبلدية حمادي</div>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Espace admin · coaches · staff</p>
        <div className="field">
          <label>Email / téléphone</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <div className="error">{error}</div>}
        <button style={{ width: "100%", marginTop: 8 }} disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
