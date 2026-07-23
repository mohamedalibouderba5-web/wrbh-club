import { api, uploadPhoto } from "../api/client";
import {
  isNetworkError,
  listPendingRegistrations,
  notifyOfflineQueueChanged,
  removePendingRegistration,
  updatePendingRegistration,
  type PendingRegistration,
} from "./registrationQueue";

let syncing = false;

export type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

async function syncOne(entry: PendingRegistration): Promise<"ok" | "retry" | "fail"> {
  await updatePendingRegistration(entry.localId, { status: "syncing", lastError: undefined });
  try {
    let photoPath = entry.payload.photo_path;
    if (entry.photoBlob) {
      const file = new File(
        [entry.photoBlob],
        entry.photoName || "photo.jpg",
        { type: entry.photoType || "image/jpeg" },
      );
      const up = await uploadPhoto(file);
      photoPath = up.path;
    }
    const body = {
      ...entry.payload,
      photo_path: photoPath,
      athlete: {
        ...entry.payload.athlete,
        photo_path: photoPath,
      },
      source: entry.payload.source || "web-offline",
    };
    await api("/api/v1/registrations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await removePendingRegistration(entry.localId);
    return "ok";
  } catch (err) {
    if (isNetworkError(err)) {
      await updatePendingRegistration(entry.localId, {
        status: "pending",
        lastError: "Réseau indisponible — nouvel essai plus tard",
      });
      return "retry";
    }
    const msg = err instanceof Error ? err.message : "Erreur sync";
    await updatePendingRegistration(entry.localId, { status: "error", lastError: msg });
    return "fail";
  }
}

/** Envoie les inscriptions locales vers l'API (FIFO). */
export async function syncPendingRegistrations(): Promise<SyncResult> {
  if (syncing) {
    const remaining = (await listPendingRegistrations()).length;
    return { synced: 0, failed: 0, remaining };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = (await listPendingRegistrations()).length;
    return { synced: 0, failed: 0, remaining };
  }

  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const rows = await listPendingRegistrations();
    for (const entry of rows) {
      if (entry.status === "error") {
        // Réessaie aussi les erreurs (validation peut avoir changé) sauf si on veut skip — on retry une fois
      }
      const result = await syncOne(entry);
      if (result === "ok") synced += 1;
      else if (result === "fail") failed += 1;
      else break; // réseau coupé → stop FIFO
    }
  } finally {
    syncing = false;
    notifyOfflineQueueChanged();
  }
  const remaining = (await listPendingRegistrations()).length;
  if (synced > 0) {
    window.dispatchEvent(new CustomEvent("wrbh:offline-synced", { detail: { synced } }));
  }
  return { synced, failed, remaining };
}

export function startOfflineSyncListeners() {
  const run = () => {
    void syncPendingRegistrations().catch(() => undefined);
  };
  const onVis = () => {
    if (document.visibilityState === "visible") run();
  };
  window.addEventListener("online", run);
  window.addEventListener("wrbh:server-awake", run);
  document.addEventListener("visibilitychange", onVis);
  run();
  return () => {
    window.removeEventListener("online", run);
    window.removeEventListener("wrbh:server-awake", run);
    document.removeEventListener("visibilitychange", onVis);
  };
}
