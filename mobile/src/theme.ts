/** Shared visual tokens for WRBH mobile — aligned with web brand. */
export const colors = {
  blue: "#1E3A8A",
  navy: "#0f1f4d",
  gold: "#F5C518",
  bg: "#eef2fb",
  card: "#ffffff",
  muted: "#5b6478",
  border: "#d7deee",
  danger: "#dc2626",
  success: "#166534",
  softRed: "#fde8e8",
  softGold: "#fff3c4",
  softBlue: "#dbeafe",
  softGray: "#f8fafc",
};

export const statusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "confirmed" || s === "present" || s === "active") return "#166534";
  if (s === "overdue" || s === "declined" || s === "absent" || s === "cancelled") return "#b91c1c";
  if (s === "partial" || s === "pending" || s === "late") return "#a16207";
  return "#5b6478";
};

export const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    paid: "Payé",
    overdue: "En retard",
    due: "À payer",
    partial: "Partiel",
    pending: "En attente",
    confirmed: "Confirmé",
    declined: "Décliné",
    excused: "Excusé",
    present: "Présent",
    absent: "Absent",
    late: "Retard",
    open: "Ouvert",
    closed: "Fermé",
    training: "Entraînement",
    match: "Match",
    meeting: "Réunion",
    other: "Autre",
  };
  return map[(status || "").toLowerCase()] || status;
};

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-DZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function fmtMoney(n: number | string | undefined) {
  return `${Number(n || 0).toLocaleString("fr-DZ")} DZD`;
}
