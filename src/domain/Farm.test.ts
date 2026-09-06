import { describe, expect, it } from 'vitest';
import { createFarm } from './Farm';

describe('createFarm', () => {
  it('rejects an empty name', () => {
    expect(() => createFarm({ name: '  ', geoReference: { kind: 'simulation' } })).toThrow(/non-empty name/);
  });

  it('defaults timezone to UTC and leaves area unknown', () => {
    const farm = createFarm({ name: 'Demo Farm', geoReference: { kind: 'simulation' } });
    expect(farm.timezone).toBe('UTC');
    expect(farm.areaHectares).toBeNull();
  });
});
