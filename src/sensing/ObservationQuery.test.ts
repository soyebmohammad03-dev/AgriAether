import { describe, expect, it } from 'vitest';
import { observationsSince, findMissingObservationTypes, latestObservationOfType } from './ObservationQuery';
import type { Observation } from '../observation/Observation';

function obs(overrides: Partial<Observation<number>>): Observation<number> {
  return {
    id: 'o1',
    type: 'ground.air_temperature',
    value: 20,
    unit: 'degC',
    timestamp: 1000,
    location: null,
    source: 'sensor:s1',
    provenance: 'MEASURED',
    confidence: null,
    status: 'OK',
    fieldId: 'field_1',
    zoneId: 'zone_1',
    ...overrides
  };
}

describe('observationsSince', () => {
  it('returns only matching-field observations at or after the cutoff, newest first', () => {
    const result = observationsSince(
      [obs({ id: 'a', timestamp: 500 }), obs({ id: 'b', timestamp: 1500 }), obs({ id: 'c', fieldId: 'field_2', timestamp: 2000 })],
      'field_1',
      1000
    );
    expect(result.map((o) => o.id)).toEqual(['b']);
  });
});

describe('findMissingObservationTypes', () => {
  it('reports expected types with zero observations for the zone', () => {
    const missing = findMissingObservationTypes([obs({ type: 'ground.air_temperature' })], 'zone_1', [
      'ground.air_temperature',
      'ground.rainfall'
    ]);
    expect(missing).toEqual(['ground.rainfall']);
  });

  it('does not count another zone\'s observations as present', () => {
    const missing = findMissingObservationTypes([obs({ type: 'ground.rainfall', zoneId: 'zone_2' })], 'zone_1', ['ground.rainfall']);
    expect(missing).toEqual(['ground.rainfall']);
  });
});

describe('latestObservationOfType', () => {
  it('returns null when no observation of that type exists, never a synthesized value', () => {
    expect(latestObservationOfType([], 'field_1', 'ground.rainfall')).toBeNull();
  });

  it('returns the most recent matching observation', () => {
    const result = latestObservationOfType(
      [obs({ id: 'a', timestamp: 500 }), obs({ id: 'b', timestamp: 1500 })],
      'field_1',
      'ground.air_temperature'
    );
    expect(result?.id).toBe('b');
  });
});
