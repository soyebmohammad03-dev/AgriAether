import { describe, expect, it } from 'vitest';
import { deterministicObservationId, deterministicFieldBoundaryId } from './ImportIdentity';

describe('deterministicObservationId', () => {
  const base = { sourceId: 'source_1', type: 'soil.moisture', timestamp: 1000, value: 35.5, unit: 'percent', lat: 10, lon: 20 };

  it('is stable for identical inputs', () => {
    expect(deterministicObservationId(base)).toBe(deterministicObservationId({ ...base }));
  });

  it('differs when the value differs', () => {
    expect(deterministicObservationId(base)).not.toBe(deterministicObservationId({ ...base, value: 36 }));
  });

  it('differs when the source differs', () => {
    expect(deterministicObservationId(base)).not.toBe(deterministicObservationId({ ...base, sourceId: 'source_2' }));
  });

  it('differs when the timestamp differs', () => {
    expect(deterministicObservationId(base)).not.toBe(deterministicObservationId({ ...base, timestamp: 2000 }));
  });
});

describe('deterministicFieldBoundaryId', () => {
  it('is stable for identical geometry text and differs otherwise', () => {
    const a = deterministicFieldBoundaryId('source_1', 'farm_1', '{"type":"Polygon"}');
    const b = deterministicFieldBoundaryId('source_1', 'farm_1', '{"type":"Polygon"}');
    const c = deterministicFieldBoundaryId('source_1', 'farm_1', '{"type":"MultiPolygon"}');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
