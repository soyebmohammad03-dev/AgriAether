import { describe, expect, it } from 'vitest';
import { buildFusionInventory } from './SensorFusion';
import type { Observation } from '../observation/Observation';

function obs(overrides: Partial<Observation<number>>): Observation<number> {
  return {
    id: 'o',
    type: 'drone.altitude.agl',
    value: 8,
    unit: 'm',
    timestamp: 1000,
    location: { frame: 'simulation-local', x: 0, y: 8, z: 0 },
    source: 'sim-sensor:barometer',
    provenance: 'SIMULATED',
    confidence: 0.9,
    status: 'OK',
    ...overrides
  };
}

describe('buildFusionInventory', () => {
  it('returns an empty inventory for no observations', () => {
    const inventory = buildFusionInventory([]);
    expect(inventory.observationTypes).toEqual([]);
    expect(inventory.timeRangeMs).toBeNull();
  });

  it('never combines sources into a single score — only reports what is present', () => {
    const inventory = buildFusionInventory([
      obs({ id: 'a', type: 'drone.altitude.agl', timestamp: 1000, confidence: 0.9 }),
      obs({ id: 'b', type: 'weather.air_temperature', timestamp: 2000, provenance: 'EXTERNAL', source: 'external:open-meteo', confidence: null, location: { frame: 'geodetic', crs: 'EPSG:4326', lat: 0, lon: 0 } })
    ]);
    expect(inventory.observationTypes.sort()).toEqual(['drone.altitude.agl', 'weather.air_temperature']);
    expect(inventory.timeRangeMs).toEqual([1000, 2000]);
    expect(inventory.locationFrames.sort()).toEqual(['geodetic', 'simulation-local']);
    expect(inventory.countByProvenance).toEqual({ SIMULATED: 1, EXTERNAL: 1 });
    expect(inventory.averageConfidence).toBeCloseTo(0.9, 5); // only the one observation with a confidence value counts
    expect(inventory).not.toHaveProperty('overallScore');
    expect(inventory).not.toHaveProperty('healthScore');
  });
});
