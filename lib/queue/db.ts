"use client";

const DB_NAME = "home_made";
const DB_VERSION = 1;
const ITEMS_STORE = "items";
const QUEUE_STORE = "queue";

export type CachedItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  avg_unit_cost: number;
  category: string | null;
  supplier: string | null;
};

export type QueuedMovement = {
  localId: number;
  item_id: string;
  kind: "IN" | "OUT";
  quantity: number;
  unit_cost: number | null;
  site: string | null;
  chantier_id: string | null;
  note: string | null;
  queued_at: string;
  attempts?: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponible"));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        db.createObjectStore(ITEMS_STORE, { keyPath: "sku" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, {
          keyPath: "localId",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | T,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const result = fn(s);
        t.oncomplete = () => {
          if (result && typeof (result as IDBRequest).result !== "undefined") {
            resolve((result as IDBRequest).result as T);
          } else {
            resolve(result as T);
          }
        };
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function cacheItems(items: CachedItem[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(ITEMS_STORE, "readwrite");
    const s = t.objectStore(ITEMS_STORE);
    s.clear();
    for (const it of items) s.put(it);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function getCachedBySku(sku: string): Promise<CachedItem | undefined> {
  return tx<CachedItem | undefined>(ITEMS_STORE, "readonly", (s) =>
    s.get(sku),
  );
}

export function getAllCached(): Promise<CachedItem[]> {
  return tx<CachedItem[]>(ITEMS_STORE, "readonly", (s) => s.getAll());
}

export async function enqueueMovement(
  m: Omit<QueuedMovement, "localId" | "queued_at">,
): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(QUEUE_STORE, "readwrite");
    const s = t.objectStore(QUEUE_STORE);
    const req = s.add({
      ...m,
      queued_at: new Date().toISOString(),
      attempts: 0,
    } as QueuedMovement);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export function pendingMovements(): Promise<QueuedMovement[]> {
  return tx<QueuedMovement[]>(QUEUE_STORE, "readonly", (s) => s.getAll());
}

export async function removeFromQueue(localId: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(QUEUE_STORE, "readwrite");
    t.objectStore(QUEUE_STORE).delete(localId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function bumpAttempt(localId: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(QUEUE_STORE, "readwrite");
    const s = t.objectStore(QUEUE_STORE);
    const get = s.get(localId);
    get.onsuccess = () => {
      const m = get.result as QueuedMovement | undefined;
      if (!m) return;
      m.attempts = (m.attempts ?? 0) + 1;
      s.put(m);
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
