import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";

/** Modal forcé si must_change_password. */
export function ChangePasswordGate() {
  const { mustChangePassword, clearMustChangePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!mustChangePassword) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) {
      setError("Minimum 8 caractères");
      return;
    }
    if (next !== confirm) {
      setError("Confirmation différente");
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      clearMustChangePassword();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pwd-gate-backdrop">
      <form className="card pwd-gate" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>Changer le mot de passe</h3>
        <p className="muted">
          Pour la sécurité des comptes (surtout parents), un nouveau mot de passe personnel est obligatoire.
        </p>
        <div className="field">
          <label>Mot de passe actuel (temporaire)</label>
          <input type="password" required className="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label>Nouveau mot de passe</label>
          <input type="password" required className="ltr" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirmer</label>
          <input
            type="password"
            required
            className="ltr"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" disabled={busy}>
            {busy ? "…" : "Enregistrer"}
          </button>
          <button type="button" className="secondary" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </form>
    </div>
  );
}
