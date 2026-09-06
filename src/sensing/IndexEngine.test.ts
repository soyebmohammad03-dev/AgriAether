import { describe, expect, it } from 'vitest';
import { calculateIndex } from './IndexEngine';
import { createMultispectralReading } from './MultispectralReading';

describe('calculateIndex — scientific honesty invariants', () => {
  it('RGB-only data (no NIR) cannot produce NDVI — returns INSUFFICIENT_DATA, never a number', () => {
    const rgbOnly = createMultispectralReading({
      bands: { RED: 0.1, GREEN: 0.08, BLUE: 0.05 }, // no NIR
      unitKind: 'reflectance',
      capturedAt: Date.now(),
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('NDVI', rgbOnly);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.value).toBeNull();
    expect(result.missingBands).toContain('NIR');
  });

  it('computes NDVI correctly when Red and NIR are both present as reflectance', () => {
    const reading = createMultispectralReading({
      bands: { RED: 0.1, NIR: 0.5 },
      unitKind: 'reflectance',
      capturedAt: Date.now(),
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('NDVI', reading);
    expect(result.status).toBe('OK');
    expect(result.value).toBeCloseTo((0.5 - 0.1) / (0.5 + 0.1), 6);
    expect(result.quality).toBe('VALID');
  });

  it('rejects uncalibrated radiance readings — UNSUPPORTED, not a fabricated index value', () => {
    const radianceReading = createMultispectralReading({
      bands: { RED: 120, NIR: 300 }, // raw sensor units, not reflectance
      unitKind: 'radiance',
      capturedAt: Date.now(),
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('NDVI', radianceReading);
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.value).toBeNull();
  });

  it('NDRE requires RED_EDGE specifically — RED does not substitute for it', () => {
    const reading = createMultispectralReading({
      bands: { RED: 0.1, NIR: 0.5 }, // has RED, not RED_EDGE
      unitKind: 'reflectance',
      capturedAt: Date.now(),
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('NDRE', reading);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.missingBands).toEqual(['RED_EDGE']);
  });

  it('flags a numerically unstable EVI result as QUESTIONABLE rather than hiding it', () => {
    const reading = createMultispectralReading({
      bands: { BLUE: 0.9, RED: 0.9, NIR: 0.01 }, // contrived to blow up the EVI denominator
      unitKind: 'reflectance',
      capturedAt: Date.now(),
      provenance: 'SIMULATED'
    });
    const result = calculateIndex('EVI', reading);
    expect(result.status).toBe('OK');
    expect(result.quality).toBe('QUESTIONABLE');
  });
});
