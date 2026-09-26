import { useEffect, useState } from "react";
import { api } from "../api/client";
import { toast } from "./Toast";

type Season = { id: number; name: string; is_current: boolean };
type Category = { id: number; code: string; season_id?: number };
type Template = { id: string; label_fr: string; description: string };

type Props = {
  defaultSeasonId?: number;
};

export function ExportPanel({ defaultSeasonId }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [seasonId, setSeasonId] = useState<number | "">(defaultSeasonId || "");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<Season[]>("/api/v1/seasons"),
      api<Category[]>("/api/v1/categories"),
      api<Template[]>("/api/v1/exports/templates"),
    ])
      .then(([s, c, t]) => {
        setSeasons(s);
        setCategories(c);
        setTemplates(t);
        if (!seasonId) {
          const cur = s.find((x) => x.is_current) || s[0];
          if (cur) setSeasonId(cur.id);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function download(template: string) {
    setBusy(template);
    try {
      const token = localStorage.getItem("wrbh_token");
      const q = new URLSearchParams({ template });
      if (seasonId) q.set("season_id", String(seasonId));
      if (categoryId) q.set("category_id", String(categoryId));
      const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${base}/api/v1/exports/workbook?${q}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Export impossible");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="?([^"]+)"?/.exec(cd);
      const name = m?.[1] || `wrbh-export-${template}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast("Fichier Excel téléchargé", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur export", "error");
    } finally {
      setBusy(null);
    }
  }

  const catsForSeason = categories.filter((c) => !seasonId || !c.season_id || c.season_id === seasonId);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Télécharger Excel / تحميل Excel</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Choisissez un modèle : base complète, commande équipements, ou état des paiements. Filtrez par saison /
        catégorie.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Saison</label>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : "")}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_current ? " (actuelle)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Catégorie (optionnel)</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Toutes</option>
            {catsForSeason.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === "full" ? "accent" : "secondary"}
            disabled={!!busy}
            title={t.description}
            onClick={() => void download(t.id)}
          >
            {busy === t.id ? "…" : t.label_fr}
          </button>
        ))}
      </div>
    </div>
  );
}
