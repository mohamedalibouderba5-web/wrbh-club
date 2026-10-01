import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { GUIDE_CHAPTERS, type GuideBlock } from "./guideContent";

function BlockView({ block, ar }: { block: GuideBlock; ar: boolean }) {
  if (block.type === "p") {
    return <p className="guide-p">{ar ? block.ar : block.fr}</p>;
  }
  if (block.type === "note") {
    return <p className="guide-note">{ar ? block.ar : block.fr}</p>;
  }
  if (block.type === "steps") {
    const title = ar ? block.titleAr : block.titleFr;
    const items = ar ? block.itemsAr : block.itemsFr;
    return (
      <div className="guide-block">
        <h4>{title}</h4>
        <ol className="guide-steps">
          {items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ol>
      </div>
    );
  }
  const isDont = block.type === "dont";
  const title = ar
    ? block.titleAr || (isDont ? "لا تفعل" : "افعل")
    : block.titleFr || (isDont ? "À ne pas faire" : "À faire");
  const items = ar ? block.itemsAr : block.itemsFr;
  return (
    <div className={`guide-block ${isDont ? "guide-dont" : "guide-do"}`}>
      <h4>{title}</h4>
      <ul>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function GuidePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [openId, setOpenId] = useState<string>(GUIDE_CHAPTERS[0].id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_CHAPTERS;
    return GUIDE_CHAPTERS.filter((ch) => {
      const blob = [
        ch.titleFr,
        ch.titleAr,
        ...ch.blocks.flatMap((b) => {
          if (b.type === "p" || b.type === "note") return [b.fr, b.ar];
          if (b.type === "steps") return [b.titleFr, b.titleAr, ...b.itemsFr, ...b.itemsAr];
          return [...b.itemsFr, ...b.itemsAr, b.titleFr || "", b.titleAr || ""];
        }),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [query]);

  const active = filtered.find((c) => c.id === openId) || filtered[0];

  return (
    <div className="guide-page" dir={ar ? "rtl" : "ltr"}>
      <header className="guide-hero">
        <h2 style={{ margin: 0 }}>
          {ar ? "دليل الاستعمال والتكوين الكامل — نادي كونكت" : "Manuel d’utilisation & formation complète — Nadi Connect"}
        </h2>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          {ar
            ? "خطوات عملية، علاقات الوحدات، وما يجب تجنّبه. ابحث أو افتح فصلاً من الفهرس."
            : "Étapes concrètes, relations entre modules, et interdits. Cherchez ou ouvrez un chapitre."}
        </p>
        <input
          className="guide-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ar ? "بحث في الدليل…" : "Rechercher dans le guide…"}
          aria-label={ar ? "بحث" : "Recherche"}
        />
      </header>

      <div className="guide-layout">
        <nav className="guide-toc card" aria-label="Sommaire">
          <strong>{ar ? "الفهرس" : "Sommaire"}</strong>
          <ol>
            {filtered.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  className={active?.id === ch.id ? "active" : ""}
                  onClick={() => setOpenId(ch.id)}
                >
                  {ar ? ch.titleAr : ch.titleFr}
                </button>
              </li>
            ))}
          </ol>
          {!filtered.length && <p className="muted">{ar ? "لا نتائج" : "Aucun résultat"}</p>}
          <div className="guide-toc-links">
            <Link to="/pricing">{ar ? "العروض" : "Offres"}</Link>
            <Link to="/onboard">{ar ? "إنشاء نادي" : "Créer un club"}</Link>
            <Link to="/download">{ar ? "التطبيق" : "App"}</Link>
          </div>
        </nav>

        <div className="guide-content">
          {active ? (
            <article className="card guide-section open" key={active.id}>
              <h3 style={{ marginTop: 0 }}>{ar ? active.titleAr : active.titleFr}</h3>
              {active.blocks.map((b, i) => (
                <BlockView key={`${active.id}-${i}`} block={b} ar={ar} />
              ))}
            </article>
          ) : null}

          <div className="card guide-diagram">
            <h3 style={{ marginTop: 0 }}>{ar ? "مخطط العلاقات" : "Schéma des relations"}</h3>
            <pre className="guide-pre">{`Club
 ├─ Saison courante
 │   ├─ Disciplines (sports) → Catégories → Équipes → Coachs
 │   └─ Inscriptions → Athlètes ↔ Parents
 │         └─ Échéances / Paiements (Finance)
 ├─ Agenda → Présences → Notifications parents
 ├─ Matériel · Annonces · Comptes · Historique/Corbeille
 └─ App Android (miroir parents / coachs)`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
