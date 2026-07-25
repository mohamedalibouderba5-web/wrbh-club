export type SortDir = "asc" | "desc";

type Props = {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
};

/** En-tête de colonne cliquable (tri type Excel : clic = inverser le sens). */
export function SortHeader({ label, sortKey, activeKey, dir, onSort, align = "left" }: Props) {
  const active = activeKey === sortKey;
  const indicator = active ? (dir === "desc" ? "▼" : "▲") : "↕";
  return (
    <th
      className={`sortable${active ? " sorted" : ""}`}
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer", whiteSpace: "nowrap", textAlign: align }}
      title="Cliquer pour trier"
    >
      <span>{label}</span>
      <span className="sort-ind" aria-hidden>
        {indicator}
      </span>
    </th>
  );
}
