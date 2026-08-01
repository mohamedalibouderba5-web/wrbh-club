import { useEffect, useState } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & {
  id: number;
  resolve: (ok: boolean) => void;
};

const listeners = new Set<(p: Pending | null) => void>();
let seq = 0;
let current: Pending | null = null;

function notify(p: Pending | null) {
  current = p;
  listeners.forEach((l) => l(p));
}

/** Confirmation in-app (remplace window.confirm du navigateur). */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const options: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  return new Promise((resolve) => {
    if (current) {
      current.resolve(false);
    }
    notify({
      id: ++seq,
      title: options.title || "Confirmation",
      message: options.message,
      confirmLabel: options.confirmLabel || "Confirmer",
      cancelLabel: options.cancelLabel || "Annuler",
      danger: options.danger !== false,
      resolve,
    });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const on = (p: Pending | null) => setPending(p);
    listeners.add(on);
    setPending(current);
    return () => {
      listeners.delete(on);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pending.resolve(false);
        notify(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!pending) return null;

  function close(ok: boolean) {
    pending!.resolve(ok);
    notify(null);
  }

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div className="card modal confirm-modal">
        <h3 id="confirm-title" style={{ marginTop: 0 }}>
          {pending.title}
        </h3>
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>{pending.message}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={() => close(false)}>
            {pending.cancelLabel}
          </button>
          <button
            type="button"
            className={pending.danger ? "danger" : undefined}
            onClick={() => close(true)}
            autoFocus
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
