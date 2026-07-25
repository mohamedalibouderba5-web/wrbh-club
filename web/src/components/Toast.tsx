import { useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const listeners = new Set<(t: ToastItem) => void>();
let counter = 0;

/** Affiche un message flottant non-bloquant (pas de clic OK requis). */
export function toast(message: string, kind: ToastKind = "success") {
  const item: ToastItem = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      const ttl = t.kind === "error" ? 6000 : 3200;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, ttl);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-icon">{t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}</span>
          <span>{t.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Fermer"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
