import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbRepository } from './IndexedDbRepository';
import { resetDatabaseConnectionForTests } from './AgriAetherDatabase';

interface Widget {
  id: string;
  name: string;
}

describe('IndexedDbRepository', () => {
  beforeEach(async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('agriaether');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  afterEach(() => {
    resetDatabaseConnectionForTests();
  });

  it('saves and retrieves by id', async () => {
    const repo = new IndexedDbRepository<Widget>('farms');
    await repo.save({ id: 'w1', name: 'Widget One' });
    expect(await repo.getById('w1')).toEqual({ id: 'w1', name: 'Widget One' });
  });

  it('survives a fresh repository instance against the same database — i.e. a reload', async () => {
    const first = new IndexedDbRepository<Widget>('farms');
    await first.save({ id: 'w1', name: 'Persisted Widget' });

    // A brand new repository instance, as if the app had been reloaded.
    const second = new IndexedDbRepository<Widget>('farms');
    expect(await second.getById('w1')).toEqual({ id: 'w1', name: 'Persisted Widget' });
  });

  it('deletes by id', async () => {
    const repo = new IndexedDbRepository<Widget>('farms');
    await repo.save({ id: 'w1', name: 'One' });
    await repo.delete('w1');
    expect(await repo.getById('w1')).toBeNull();
  });

  it('lists everything saved', async () => {
    const repo = new IndexedDbRepository<Widget>('fields');
    await repo.save({ id: 'a', name: 'A' });
    await repo.save({ id: 'b', name: 'B' });
    expect((await repo.list()).map((w) => w.id).sort()).toEqual(['a', 'b']);
  });
});
