/**
 * The one persistence contract every domain module depends on. Nothing in
 * `domain/`, `world/`, or `app/` should import IndexedDB (or any other
 * storage API) directly — they take a `Repository<T>` and don't know or
 * care whether it's backed by memory, IndexedDB, or (later) a server.
 *
 * This is also the seam for the offline-first direction documented in the
 * README: a future `SyncingRepository<T>` can wrap a local Repository with
 * a sync queue and a remote endpoint without anything upstream changing.
 */
export interface Repository<T extends { id: string }> {
  getById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
