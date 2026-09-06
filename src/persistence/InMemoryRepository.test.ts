import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from './InMemoryRepository';

interface Widget {
  id: string;
  name: string;
}

describe('InMemoryRepository', () => {
  it('saves and retrieves by id', async () => {
    const repo = new InMemoryRepository<Widget>();
    await repo.save({ id: 'w1', name: 'Widget One' });
    expect(await repo.getById('w1')).toEqual({ id: 'w1', name: 'Widget One' });
  });

  it('returns null for an unknown id', async () => {
    const repo = new InMemoryRepository<Widget>();
    expect(await repo.getById('missing')).toBeNull();
  });

  it('lists everything saved', async () => {
    const repo = new InMemoryRepository<Widget>();
    await repo.save({ id: 'w1', name: 'One' });
    await repo.save({ id: 'w2', name: 'Two' });
    expect((await repo.list()).map((w) => w.id).sort()).toEqual(['w1', 'w2']);
  });

  it('deletes by id', async () => {
    const repo = new InMemoryRepository<Widget>();
    await repo.save({ id: 'w1', name: 'One' });
    await repo.delete('w1');
    expect(await repo.getById('w1')).toBeNull();
  });
});
