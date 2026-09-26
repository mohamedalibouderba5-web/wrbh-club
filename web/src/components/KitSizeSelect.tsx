/** Tailles équipement : romaines (priorité) + âges + saisie manuelle. */
export const KIT_ROMAN_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"] as const;

export const KIT_AGE_SIZES = [
  "6 ans",
  "7 ans",
  "8 ans",
  "9 ans",
  "10 ans",
  "11 ans",
  "12 ans",
  "13 ans",
  "14 ans",
  "15 ans",
  "16 ans",
] as const;

export const KIT_SIZE_OPTIONS = [
  ...KIT_ROMAN_SIZES.map((s) => ({ value: s, group: "Roman" as const })),
  ...KIT_AGE_SIZES.map((s) => ({ value: s, group: "Âge" as const })),
];

export const KIT_MANUAL = "__manual__";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

export function KitSizeSelect({ value, onChange, label = "Taille / مقاس" }: Props) {
  const known = KIT_SIZE_OPTIONS.some((o) => o.value === value);
  const mode = !value ? "" : known ? value : KIT_MANUAL;
  const showManual = mode === KIT_MANUAL;

  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === KIT_MANUAL) {
            onChange(known ? "" : value || "");
          } else {
            onChange(v);
          }
        }}
      >
        <option value="">— Choisir —</option>
        <optgroup label="Tailles romaines (priorité)">
          {KIT_ROMAN_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </optgroup>
        <optgroup label="Par âge">
          {KIT_AGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </optgroup>
        <option value={KIT_MANUAL}>Saisie manuelle…</option>
      </select>
      {showManual && (
        <input
          style={{ marginTop: 6 }}
          placeholder="Ex. 128 cm, 10 ans, XS…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
