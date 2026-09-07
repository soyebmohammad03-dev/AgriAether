export const DATABASE_NAME = 'agriaether';
export const DATABASE_VERSION = 5;

/** One object store per repository, all keyed by the entity's own `id`. */
export const STORE_NAMES = [
  'farms',
  'fields',
  'zones',
  'cropCycles',
  'sensors',
  'sensorDeployments',
  'observations',
  'agriculturalEvents',
  'weatherCache',
  'datasets',
  'soilSamples',
  'groundSamples',
  'cropObservations',
  'dataSources',
  'importRecords'
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;
let openDb: IDBDatabase | null = null;

/**
 * Opens (and caches) the single shared AgriAether IndexedDB database. All
 * IndexedDbRepository instances in one process share this connection —
 * IndexedDB allows exactly one open connection per version to serve
 * multiple transactions concurrently, so there's no reason to open more.
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => {
      openDb = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/** Test-only: close and drop the cached connection so a fresh openDatabase() reopens it (e.g. against a reset fake-indexeddb) without blocking a subsequent deleteDatabase(). */
export function resetDatabaseConnectionForTests(): void {
  openDb?.close();
  openDb = null;
  dbPromise = null;
}
