import type { Repository } from './Repository';

/**
 * A trivial reference implementation of Repository<T>, backed by a Map.
 * Used in tests (no browser storage available under Vitest's node
 * environment) and as the fallback when IndexedDB genuinely isn't
 * available. Data does not survive a process restart — see
 * IndexedDbRepository for the one that does.
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly rows = new Map<string, T>();

  async getById(id: string): Promise<T | null> {
    return this.rows.get(id) ?? null;
  }

  async list(): Promise<T[]> {
    return Array.from(this.rows.values());
  }

  async save(entity: T): Promise<void> {
    this.rows.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}
