import { FormEvent, useEffect, useState } from "react";
import { api, apiGetFast } from "../api/client";
import { confirmDialog } from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

type Item = {
  id: number;
  name: string;
  quantity: number;
  alert_threshold: number;
  location?: string;
  notes?: string;
  item_kind?: string;
};
type Athlete = { id: number; full_name: string };
type Assignment = {
  id: number;
  item_id?: number;
  item_name?: string;
  item_kind?: string;
  athlete_id?: number;
  athlete_name?: string;
  quantity: number;
  assigned_on?: string;
  status: string;
};

const ITEM_KINDS = [
  { value: "jersey", label: "Maillot / قميص" },
  { value: "shorts", label: "Short / شورت" },
  { value: "boots", label: "Chaussures / حذاء" },
  { value: "backpack", label: "Sac / حقيبة" },
  { value: "other", label: "Autre" },
];

export function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Item[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("10");
  const [cost, setCost] = useState("");
  const [itemKind, setItemKind] = useState("jersey");
  const [assignAthlete, setAssignAthlete] = useState("");
  const [assignItem, setAssignItem] = useState("");
  const [assignQty, setAssignQty] = useState("1");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editAsg, setEditAsg] = useState<Assignment | null>(null);

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
          item_kind: itemKind,
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

  async function saveItem() {
    if (!editItem) return;
    try {
      await api(`/api/v1/inventory/items/${editItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editItem.name,
          quantity: Number(editItem.quantity),
          alert_threshold: Number(editItem.alert_threshold),
          location: editItem.location || null,
          item_kind: editItem.item_kind || "other",
        }),
      });
      toast("Article modifié", "success");
      setEditItem(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  async function saveAssignment() {
    if (!editAsg) return;
    try {
      await api(`/api/v1/inventory/assignments/${editAsg.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: Number(editAsg.quantity),
          status: editAsg.status,
          athlete_id: editAsg.athlete_id || null,
        }),
      });
      toast("Attribution modifiée", "success");
      setEditAsg(null);
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
            <label>Type d’article</label>
            <select value={itemKind} onChange={(e) => setItemKind(e.target.value)}>
              {ITEM_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
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
          {editItem && (
            <div style={{ marginBottom: "0.75rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
              <strong>Modifier l’article</strong>
              <div className="field">
                <label>Nom</label>
                <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Quantité</label>
                <input
                  className="ltr"
                  value={editItem.quantity}
                  onChange={(e) => setEditItem({ ...editItem, quantity: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label>Seuil alerte</label>
                <input
                  className="ltr"
                  value={editItem.alert_threshold}
                  onChange={(e) => setEditItem({ ...editItem, alert_threshold: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select
                  value={editItem.item_kind || "other"}
                  onChange={(e) => setEditItem({ ...editItem, item_kind: e.target.value })}
                >
                  {ITEM_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Lieu</label>
                <input
                  value={editItem.location || ""}
                  onChange={(e) => setEditItem({ ...editItem, location: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="accent" onClick={saveItem}>
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditItem(null)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Type</th>
                <th>Qté</th>
                <th>Seuil</th>
                <th>Lieu</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{ITEM_KINDS.find((k) => k.value === i.item_kind)?.label || i.item_kind || "—"}</td>
                  <td>{i.quantity}</td>
                  <td>{i.alert_threshold}</td>
                  <td>{i.location ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setEditItem({ ...i })}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Supprimer l'article",
                            message: `Supprimer « ${i.name} » du stock ?`,
                            confirmLabel: "Supprimer",
                          });
                          if (!ok) return;
                          try {
                            await api(`/api/v1/inventory/items/${i.id}`, { method: "DELETE" });
                            toast("Article supprimé", "success");
                            load();
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Erreur", "error");
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attributions récentes</h3>
          {editAsg && (
            <div style={{ marginBottom: "0.75rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
              <strong>
                Modifier — {editAsg.item_name} → {editAsg.athlete_name || "—"}
              </strong>
              <div className="field">
                <label>Quantité</label>
                <input
                  className="ltr"
                  value={editAsg.quantity}
                  onChange={(e) => setEditAsg({ ...editAsg, quantity: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="field">
                <label>Statut</label>
                <select value={editAsg.status} onChange={(e) => setEditAsg({ ...editAsg, status: e.target.value })}>
                  <option value="out">Sorti</option>
                  <option value="returned">Retourné (restock)</option>
                  <option value="lost">Perdu</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="accent" onClick={saveAssignment}>
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditAsg(null)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Article</th>
                <th>Joueur</th>
                <th>Qté</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.assigned_on || "—"}</td>
                  <td>{a.item_name || "—"}</td>
                  <td>{a.athlete_name || "—"}</td>
                  <td>{a.quantity}</td>
                  <td>
                    <span className="badge">{a.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setEditAsg({ ...a })}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Supprimer l'attribution",
                            message: `Supprimer « ${a.item_name} → ${a.athlete_name || "—"} » ?`,
                            confirmLabel: "Supprimer",
                          });
                          if (!ok) return;
                          try {
                            await api(`/api/v1/inventory/assignments/${a.id}?restock=true`, { method: "DELETE" });
                            toast("Attribution supprimée", "success");
                            load();
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Erreur", "error");
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!assignments.length && (
                <tr>
                  <td colSpan={6} className="muted">
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
