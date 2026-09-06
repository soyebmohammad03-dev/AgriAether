import { describe, expect, it } from 'vitest';
import { checkTemporalCompatibility } from './TemporalAlignment';
import { createRasterMetadata } from './Raster';

function metadata(overrides: Partial<Parameters<typeof createRasterMetadata>[0]> = {}) {
  return createRasterMetadata({
    widthPx: 4,
    heightPx: 4,
    extent: [-0.001, -0.001, 0.001, 0.001],
    bands: [{ name: 'RED', index: 0, unit: 'reflectance', wavelengthNm: 660 }, { name: 'NIR', index: 1, unit: 'reflectance', wavelengthNm: 840 }],
    acquiredAt: Date.UTC(2026, 3, 1),
    source: 'test',
    ...overrides
  });
}

describe('checkTemporalCompatibility', () => {
  it('accepts two rasters covering the same extent at different times', () => {
    const a = metadata({ acquiredAt: Date.UTC(2026, 3, 1) });
    const b = metadata({ acquiredAt: Date.UTC(2026, 3, 15) });
    expect(checkTemporalCompatibility(a, b, 'RED').status).toBe('COMPATIBLE');
  });

  it('rejects identical timestamps as INSUFFICIENT_DATA — nothing to compare temporally', () => {
    const t = Date.UTC(2026, 3, 1);
    const a = metadata({ acquiredAt: t });
    const b = metadata({ acquiredAt: t });
    expect(checkTemporalCompatibility(a, b, 'RED').status).toBe('INSUFFICIENT_DATA');
  });

  it('rejects a band missing from one raster as INCOMPATIBLE_DATA', () => {
    const a = metadata({ acquiredAt: Date.UTC(2026, 3, 1) });
    const b = metadata({ acquiredAt: Date.UTC(2026, 3, 15), bands: [{ name: 'RED', index: 0, unit: 'reflectance', wavelengthNm: 660 }] });
    const result = checkTemporalCompatibility(a, b, 'NIR');
    expect(result.status).toBe('INCOMPATIBLE_DATA');
    expect(result.reasons.some((r) => r.includes('NIR'))).toBe(true);
  });

  it('rejects non-overlapping extents as INCOMPATIBLE_DATA', () => {
    const a = metadata({ extent: [-0.001, -0.001, 0.001, 0.001], acquiredAt: Date.UTC(2026, 3, 1) });
    const b = metadata({ extent: [10, 10, 10.001, 10.001], acquiredAt: Date.UTC(2026, 3, 15) });
    const result = checkTemporalCompatibility(a, b, 'RED');
    expect(result.status).toBe('INCOMPATIBLE_DATA');
    expect(result.reasons.some((r) => r.includes('overlap'))).toBe(true);
  });
});
