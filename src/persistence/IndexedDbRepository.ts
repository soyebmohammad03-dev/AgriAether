import type { Repository } from './Repository';
import { openDatabase, type StoreName } from './AgriAetherDatabase';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB-backed Repository<T>. Chosen over alternatives for Phase 2
 * because it is: built into every browser (no extra dependency or WASM
 * asset to ship), structured (native object storage, no hand-rolled JSON
 * blob to parse/corrupt), asynchronous and non-blocking (fine for a 60fps
 * render loop), and works fully offline — which matches the project's
 * offline-first direction. A single JSON blob in localStorage was
 * considered and rejected: it's synchronous (blocks the render loop under
 * load), has a much smaller storage quota, and has no per-entity
 * granularity. SQLite-via-WASM was considered and deferred: it would give
 * real SQL and easier future migration to a server database, but adds a
 * WASM asset and a heavier dependency for a Phase 2 need this already
 * meets. If a server backend arrives, only the repository implementation
 * changes — domain code depends on Repository<T>, never on IndexedDB.
 */
export class IndexedDbRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly storeName: StoreName) {}

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await openDatabase();
    return db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getById(id: string): Promise<T | null> {
    const store = await this.store('readonly');
    const result = await requestToPromise(store.get(id));
    return (result as T | undefined) ?? null;
  }

  async list(): Promise<T[]> {
    const store = await this.store('readonly');
    return requestToPromise(store.getAll()) as Promise<T[]>;
  }

  async save(entity: T): Promise<void> {
    const store = await this.store('readwrite');
    await requestToPromise(store.put(entity));
  }

  async delete(id: string): Promise<void> {
    const store = await this.store('readwrite');
    await requestToPromise(store.delete(id));
  }
}
