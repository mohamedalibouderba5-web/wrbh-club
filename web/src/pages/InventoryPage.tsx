import { FormEvent, useEffect, useState } from "react";
import { api, apiGetFast } from "../api/client";

type Item = { id: number; name: string; quantity: number; alert_threshold: number; location?: string };

export function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("10");

  async function load() {
    const [i, a] = await Promise.all([
      apiGetFast<Item[]>("/api/v1/inventory/items", { ttlMs: 45_000, onUpdate: setItems }),
      apiGetFast<Item[]>("/api/v1/inventory/alerts", { ttlMs: 45_000, onUpdate: setAlerts }).catch(() => []),
    ]);
    setItems(i);
    setAlerts(a);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/inventory/items", {
      method: "POST",
      body: JSON.stringify({ name, quantity: Number(qty), alert_threshold: 5 }),
    });
    setName("");
    load();
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <strong>Alertes stock bas :</strong> {alerts.map((a) => a.name).join(", ")}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.5fr", gap: "1rem" }}>
        <form className="card" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>Nouvel article</h3>
          <div className="field"><label>Nom</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Quantité</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <button type="submit">Ajouter</button>
        </form>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Inventaire</h3>
          <table>
            <thead><tr><th>Article</th><th>Qté</th><th>Seuil</th><th>Lieu</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.quantity}</td>
                  <td>{i.alert_threshold}</td>
                  <td>{i.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
