/**
 * Browser-only autosave (IndexedDB). Work survives a closed tab or refresh on the same browser.
 * Every call is best-effort: storage can be unavailable (private mode, quota), so failures
 * resolve to null/false instead of breaking the page.
 */
const DB_NAME = "servilab-autosave";
const STORE = "drafts";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(request ? (request.result as T) : (true as T)); };
      tx.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export const putDraft = (key: string, value: unknown) =>
  run<boolean>("readwrite", store => { store.put(value, key); });

export const getDraft = <T>(key: string) => run<T | undefined>("readonly", store => store.get(key));

export const deleteDraft = (key: string) => run<boolean>("readwrite", store => { store.delete(key); });

/** All [key, value] pairs whose key starts with prefix. */
export async function getDraftsByPrefix<T>(prefix: string): Promise<Array<[string, T]>> {
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
  const keys = await run<IDBValidKey[]>("readonly", store => store.getAllKeys(range));
  const values = await run<T[]>("readonly", store => store.getAll(range));
  if (!keys || !values || keys.length !== values.length) return [];
  return keys.map((key, i) => [String(key), values[i]]);
}

export const deleteDraftsByPrefix = (prefix: string) =>
  run<boolean>("readwrite", store => { store.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)); });
