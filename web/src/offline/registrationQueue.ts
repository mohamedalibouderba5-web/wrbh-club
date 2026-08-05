/** File d'attente IndexedDB pour inscriptions hors ligne. */

const DB_NAME = "wrbh_offline";
const DB_VERSION = 1;
const STORE = "pending_regs";

export type RegPayload = {
  season_id: number;
  category_id: number | null;
  team_id?: number | null;
  subscription_fee: number;
  source: string;
  parent_phone: string;
  parent_name: string | null;
  photo_path: string | null;
  athlete: {
    full_name: string;
    birth_date: string;
    birth_place: string | null;
    photo_path: string | null;
    blood_type: string | null;
  };
};

export type PendingStatus = "pending" | "syncing" | "error";

export type PendingRegistration = {
  localId: string;
  createdAt: number;
  payload: RegPayload;
  photoBlob?: Blob;
  photoName?: string;
  photoType?: string;
  status: PendingStatus;
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB indisponible"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Transaction IndexedDB"));
    tx.onabort = () => reject(tx.error || new Error("Transaction annulée"));
  });
}

export function notifyOfflineQueueChanged() {
  window.dispatchEvent(new CustomEvent("wrbh:offline-queue"));
}

export async function enqueueRegistration(
  payload: RegPayload,
  photo?: File | Blob | null,
): Promise<PendingRegistration> {
  const entry: PendingRegistration = {
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    payload,
    status: "pending",
  };
  if (photo) {
    entry.photoBlob = photo;
    entry.photoName = photo instanceof File ? photo.name : "photo.jpg";
    entry.photoType = photo.type || "image/jpeg";
  }
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    await txDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineQueueChanged();
  return entry;
}

export async function listPendingRegistrations(): Promise<PendingRegistration[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const rows = await new Promise<PendingRegistration[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as PendingRegistration[]);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function countPendingRegistrations(): Promise<number> {
  const rows = await listPendingRegistrations();
  return rows.length;
}

export async function updatePendingRegistration(
  localId: string,
  patch: Partial<Pick<PendingRegistration, "status" | "lastError" | "payload">>,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = await new Promise<PendingRegistration | undefined>((resolve, reject) => {
      const req = store.get(localId);
      req.onsuccess = () => resolve(req.result as PendingRegistration | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!existing) {
      await txDone(tx);
      return;
    }
    store.put({ ...existing, ...patch });
    await txDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineQueueChanged();
}

export async function removePendingRegistration(localId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(localId);
    await txDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineQueueChanged();
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("load failed") ||
    m.includes("networkerror") ||
    m.includes("err_internet") ||
    m.includes("offline")
  );
}
