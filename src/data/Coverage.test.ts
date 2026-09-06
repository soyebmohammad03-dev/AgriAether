import { describe, expect, it } from 'vitest';
import { computeFieldCoverage } from './Coverage';
import type { Observation } from '../observation/Observation';

function obs(timestamp: number): Observation<number> {
  return { id: `o_${timestamp}`, type: 'weather.air_temperature', value: 20, unit: 'degC', timestamp, location: null, source: 'external:open-meteo', provenance: 'EXTERNAL', confidence: null, status: 'OK' };
}

describe('computeFieldCoverage', () => {
  it('marks a sensor category unavailable when no matching sensor kind is deployed', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: ['gps', 'imu'], observations: [], weatherAvailable: false });
    expect(coverage.sensorCoverage.multispectral).toBe('unavailable');
    expect(coverage.sensorCoverage.rgb).toBe('unavailable');
  });

  it('marks weather available only from the explicit flag, not a sensor kind', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: true });
    expect(coverage.sensorCoverage.weather).toBe('available');
  });

  it('reports null spatial coverage when no raster fraction is given — never a fabricated percentage', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: false });
    expect(coverage.spatialCoveragePercent).toBeNull();
  });

  it('computes real temporal coverage and freshness from actual observation timestamps', () => {
    const now = 100_000;
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [obs(1000), obs(50_000)], weatherAvailable: true, now });
    expect(coverage.temporalCoverage.earliestObservation).toBe(1000);
    expect(coverage.temporalCoverage.latestObservation).toBe(50_000);
    expect(coverage.freshnessMs).toBe(50_000);
  });
});
