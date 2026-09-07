import { describe, expect, it } from 'vitest';
import { buildFusionInventory, categorizeSource, alignObservationEvidence } from './SensorFusion';
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

  it('preserves per-source-category counts while combining streams, per source provenance/type', () => {
    const inventory = buildFusionInventory([
      obs({ id: 'a', type: 'drone.altitude.agl' }),
      obs({ id: 'b', type: 'ground.air_temperature', provenance: 'MEASURED', sensorId: 'sensor_1', source: 'sensor:sensor_1' }),
      obs({ id: 'c', type: 'soil.moisture', provenance: 'MEASURED', sensorId: 'sensor_2', source: 'sensor:sensor_2' }),
      obs({ id: 'd', type: 'weather.air_temperature', provenance: 'EXTERNAL', source: 'external:open-meteo' })
    ]);
    expect(inventory.countBySourceCategory).toEqual({ drone: 1, 'ground-sensor': 1, soil: 1, weather: 1, historical: 0, other: 0 });
  });
});

describe('categorizeSource', () => {
  it('categorizes by type prefix and droneId, never by inspecting the value', () => {
    expect(categorizeSource(obs({ droneId: 'drone_1' }))).toBe('drone');
    expect(categorizeSource(obs({ type: 'ground.rainfall', droneId: undefined }))).toBe('ground-sensor');
    expect(categorizeSource(obs({ type: 'soil.ph', droneId: undefined }))).toBe('soil');
    expect(categorizeSource(obs({ type: 'weather.wind_speed', droneId: undefined }))).toBe('weather');
    expect(categorizeSource(obs({ type: 'unmapped.quantity', droneId: undefined, provenance: 'ESTIMATED' }))).toBe('other');
  });
});

describe('alignObservationEvidence', () => {
  it('picks the latest OK reading per type and reports missing expected types honestly', () => {
    const bundle = alignObservationEvidence({
      observations: [
        obs({ id: 'a', type: 'soil.moisture', fieldId: 'field_1', timestamp: 1000, value: 20 }),
        obs({ id: 'b', type: 'soil.moisture', fieldId: 'field_1', timestamp: 2000, value: 22 })
      ],
      fieldId: 'field_1',
      windowStartMs: 0,
      windowEndMs: 3000,
      now: 3000,
      expectedTypes: ['soil.moisture', 'weather.air_temperature']
    });
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].observation.id).toBe('b');
    expect(bundle.missingTypes).toEqual(['weather.air_temperature']);
    expect(bundle.conflicts).toEqual([]);
  });

  it('flags disagreeing same-type readings as a conflict instead of averaging them', () => {
    const bundle = alignObservationEvidence({
      observations: [
        obs({ id: 'a', type: 'soil.moisture', fieldId: 'field_1', timestamp: 1000, value: 10, sensorId: 'sensor_1' }),
        obs({ id: 'b', type: 'soil.moisture', fieldId: 'field_1', timestamp: 1000, value: 30, sensorId: 'sensor_2' })
      ],
      fieldId: 'field_1',
      windowStartMs: 0,
      windowEndMs: 2000,
      now: 2000
    });
    expect(bundle.conflicts).toHaveLength(1);
    expect(bundle.conflicts[0].type).toBe('soil.moisture');
  });

  it('marks an item STALE once its age exceeds staleAfterMs', () => {
    const bundle = alignObservationEvidence({
      observations: [obs({ id: 'a', type: 'soil.moisture', fieldId: 'field_1', timestamp: 0, value: 20 })],
      fieldId: 'field_1',
      windowStartMs: 0,
      windowEndMs: 100000,
      now: 100000,
      staleAfterMs: 5000
    });
    expect(bundle.items[0].freshness).toBe('STALE');
  });
});
