import { useEffect, useState } from "react";
import { api } from "../api/client";

type Athlete = {
  id: number;
  legacy_number?: number;
  full_name: string;
  birth_date?: string;
  birth_place?: string;
  status: string;
};

export function AthletesPage() {
  const [rows, setRows] = useState<Athlete[]>([]);
  const [q, setQ] = useState("");

  async function load(search = q) {
    const data = await api<Athlete[]>(`/api/v1/athletes${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          placeholder="Rechercher nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #d7deee" }}
        />
        <button onClick={() => load()}>Filtrer</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nom / الاسم</th>
            <th>Naissance</th>
            <th>Lieu</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.legacy_number ?? r.id}</td>
              <td>{r.full_name}</td>
              <td>{r.birth_date ?? "—"}</td>
              <td>{r.birth_place ?? "—"}</td>
              <td><span className="badge">{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
