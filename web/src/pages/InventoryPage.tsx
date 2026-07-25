import { FormEvent, useEffect, useState } from "react";
import { api, apiGetFast } from "../api/client";
import { toast } from "../components/Toast";

type Item = { id: number; name: string; quantity: number; alert_threshold: number; location?: string };
type Athlete = { id: number; full_name: string };
type Assignment = {
  id: number;
  item_name?: string;
  athlete_name?: string;
  quantity: number;
  assigned_on?: string;
  status: string;
};

export function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Item[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("10");
  const [cost, setCost] = useState("");
  const [assignAthlete, setAssignAthlete] = useState("");
  const [assignItem, setAssignItem] = useState("");
  const [assignQty, setAssignQty] = useState("1");

  async function load() {
    const [i, a, ath, asg] = await Promise.all([
      apiGetFast<Item[]>("/api/v1/inventory/items", { ttlMs: 45_000, onUpdate: setItems }),
      apiGetFast<Item[]>("/api/v1/inventory/alerts", { ttlMs: 45_000, onUpdate: setAlerts }).catch(() => []),
      apiGetFast<Athlete[]>("/api/v1/athletes?limit=200&sort=name&order=asc", { ttlMs: 60_000 }).catch(() => []),
      api<Assignment[]>("/api/v1/inventory/assignments?limit=40").catch(() => []),
    ]);
    setItems(i);
    setAlerts(a);
    setAthletes(ath);
    setAssignments(asg);
  }

  useEffect(() => {
    load();
  }, []);

  async function onPurchase(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/inventory/purchase", {
        method: "POST",
        body: JSON.stringify({
          name,
          quantity: Number(qty),
          unit_cost: Number(cost) || 0,
          athlete_id: assignAthlete ? Number(assignAthlete) : null,
        }),
      });
      toast("Équipement ajouté au stock", "success");
      setName("");
      setCost("");
      setAssignAthlete("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!assignItem) return;
    try {
      await api(
        `/api/v1/inventory/assign?item_id=${assignItem}&athlete_id=${assignAthlete || ""}&quantity=${Number(assignQty) || 1}`,
        { method: "POST" },
      );
      toast("Équipement attribué au joueur", "success");
      setAssignItem("");
      setAssignAthlete("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <strong>Alertes stock bas :</strong> {alerts.map((a) => a.name).join(", ")}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <form className="card" onSubmit={onPurchase}>
          <h3 style={{ marginTop: 0 }}>Achat équipement / شراء التجهيز</h3>
          <div className="field">
            <label>Nom (maillot, brassards, ballons…)</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Quantité</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="field">
            <label>Coût unitaire DZD</label>
            <input className="ltr" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          </div>
          <div className="field">
            <label>Attribuer directement à un joueur (optionnel)</label>
            <select value={assignAthlete} onChange={(e) => setAssignAthlete(e.target.value)}>
              <option value="">— Stock club —</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Enregistrer l’achat</button>
        </form>

        <form className="card" onSubmit={onAssign}>
          <h3 style={{ marginTop: 0 }}>Attribuer au joueur</h3>
          <div className="field">
            <label>Article en stock</label>
            <select required value={assignItem} onChange={(e) => setAssignItem(e.target.value)}>
              <option value="">—</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Joueur</label>
            <select required value={assignAthlete} onChange={(e) => setAssignAthlete(e.target.value)}>
              <option value="">—</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quantité</label>
            <input value={assignQty} onChange={(e) => setAssignQty(e.target.value)} />
          </div>
          <button type="submit">Attribuer</button>
        </form>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Inventaire</h3>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Qté</th>
                <th>Seuil</th>
                <th>Lieu</th>
              </tr>
            </thead>
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
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attributions récentes</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Article</th>
                <th>Joueur</th>
                <th>Qté</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.assigned_on || "—"}</td>
                  <td>{a.item_name || "—"}</td>
                  <td>{a.athlete_name || "—"}</td>
                  <td>{a.quantity}</td>
                </tr>
              ))}
              {!assignments.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aucune attribution
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
