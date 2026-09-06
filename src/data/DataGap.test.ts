import { describe, expect, it } from 'vitest';
import { detectDataGaps } from './DataGap';
import { computeFieldCoverage } from './Coverage';

describe('detectDataGaps', () => {
  it('reports a MISSING_SENSOR gap for every unavailable category', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: ['gps'], observations: [], weatherAvailable: true });
    const gaps = detectDataGaps(coverage);
    const missingSensorGaps = gaps.filter((g) => g.type === 'MISSING_SENSOR');
    expect(missingSensorGaps.length).toBe(4); // rgb, multispectral, thermal, soil — weather is available
  });

  it('reports MISSING_TIMESTAMPS when there is no observation history at all', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: false });
    const gaps = detectDataGaps(coverage);
    expect(gaps.some((g) => g.type === 'MISSING_TIMESTAMPS')).toBe(true);
  });

  it('reports STALE_OBSERVATIONS when the most recent observation is old', () => {
    const now = 100 * 60 * 60 * 1000;
    const coverage = computeFieldCoverage({
      fieldId: 'f1',
      availableSensorKinds: [],
      observations: [{ id: 'o', type: 'x', value: 1, unit: null, timestamp: 0, location: null, source: 'external:x', provenance: 'EXTERNAL', confidence: null, status: 'OK' }],
      weatherAvailable: true,
      now
    });
    expect(detectDataGaps(coverage).some((g) => g.type === 'STALE_OBSERVATIONS')).toBe(true);
  });

  it('reports INSUFFICIENT_SPATIAL_COVERAGE below the threshold', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: false, spatialCoverageFraction: 0.2 });
    expect(detectDataGaps(coverage).some((g) => g.type === 'INSUFFICIENT_SPATIAL_COVERAGE')).toBe(true);
  });

  it('reports no spatial-coverage gap when coverage is null (no raster ingested at all)', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: false });
    expect(detectDataGaps(coverage).some((g) => g.type === 'INSUFFICIENT_SPATIAL_COVERAGE')).toBe(false);
  });
});
