import { describe, expect, it } from 'vitest';
import { WorldRegistry } from './WorldRegistry';
import { createInMemoryRepositories } from '../persistence/repositories';
import { ensureRealTestField, REAL_TEST_FIELD_CENTER } from './realTestField';

describe('ensureRealTestField', () => {
  it('creates a real, non-Null-Island field with a valid WGS84 polygon boundary', async () => {
    const registry = await WorldRegistry.load(createInMemoryRepositories());
    const { field } = await ensureRealTestField(registry);

    expect(field.geoReference.kind).toBe('geodetic');
    if (field.geoReference.kind === 'geodetic') {
      expect(field.geoReference.geometry.type).toBe('Polygon');
      expect(field.geoReference.provenance).toBe('USER_DRAWN');
    }
    expect(REAL_TEST_FIELD_CENTER.lat).not.toBe(0);
    expect(REAL_TEST_FIELD_CENTER.lon).not.toBe(0);
    expect(field.areaHectares).toBeGreaterThan(0);
  });

  it('is idempotent — a second call returns the same field rather than duplicating it', async () => {
    const registry = await WorldRegistry.load(createInMemoryRepositories());
    const first = await ensureRealTestField(registry);
    const second = await ensureRealTestField(registry);
    expect(second.field.id).toBe(first.field.id);
    expect(registry.listFarms().length).toBe(1);
  });
});
