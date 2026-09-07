import { describe, expect, it } from 'vitest';
import { calculateIndex } from './IndexEngine';
import { createMultispectralReading } from './MultispectralReading';
import { indexResultToObservation } from './indexResultToObservation';

describe('indexResultToObservation', () => {
  it('returns null when the index calculation was not OK (never a placeholder value)', () => {
    const reading = createMultispectralReading({ bands: { RED: 0.1 }, unitKind: 'reflectance', capturedAt: Date.now(), provenance: 'SIMULATED' });
    const result = calculateIndex('NDVI', reading); // missing NIR -> INSUFFICIENT_DATA
    expect(indexResultToObservation(result, reading)).toBeNull();
  });

  it('produces a valid Observation with ESTIMATED provenance for a successful calculation', () => {
    const reading = createMultispectralReading({
      bands: { RED: 0.1, NIR: 0.5 },
      unitKind: 'reflectance',
      capturedAt: Date.now(),
      fieldId: 'field_1',
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('NDVI', reading);
    const obs = indexResultToObservation(result, reading);
    expect(obs?.type).toBe('vegetation_index.ndvi');
    expect(obs?.provenance).toBe('ESTIMATED');
    expect(obs?.fieldId).toBe('field_1');
    expect(obs?.value).toBeCloseTo((0.5 - 0.1) / (0.5 + 0.1), 5);
  });
});
