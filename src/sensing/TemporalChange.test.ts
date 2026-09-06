import { describe, expect, it } from 'vitest';
import { compareObservations } from './TemporalChange';
import type { Observation } from '../observation/Observation';

function obs(overrides: Partial<Observation<number>>): Observation<number> {
  return {
    id: 'o1',
    type: 'weather.air_temperature',
    value: 20,
    unit: 'degC',
    timestamp: 1000,
    location: null,
    source: 'external:open-meteo',
    provenance: 'EXTERNAL',
    confidence: null,
    status: 'OK',
    fieldId: 'field_1',
    zoneId: null,
    ...overrides
  };
}

describe('compareObservations', () => {
  it('reports INSUFFICIENT_DATA for different observation types', () => {
    const result = compareObservations(obs({ id: 'a' }), obs({ id: 'b', type: 'weather.wind_speed' }));
    expect(result.direction).toBe('INSUFFICIENT_DATA');
  });

  it('reports INSUFFICIENT_DATA for observations from different fields', () => {
    const result = compareObservations(obs({ id: 'a', fieldId: 'field_1' }), obs({ id: 'b', fieldId: 'field_2' }));
    expect(result.direction).toBe('INSUFFICIENT_DATA');
  });

  it('reports INSUFFICIENT_DATA when either value is null', () => {
    const result = compareObservations(obs({ id: 'a', value: null, status: 'UNAVAILABLE' }), obs({ id: 'b' }));
    expect(result.direction).toBe('INSUFFICIENT_DATA');
  });

  it('reports INCREASED for a clear rise', () => {
    const result = compareObservations(obs({ id: 'a', value: 20, timestamp: 1000 }), obs({ id: 'b', value: 30, timestamp: 2000 }));
    expect(result.direction).toBe('INCREASED');
    expect(result.delta).toBe(10);
    expect(result.intervalMs).toBe(1000);
  });

  it('reports DECREASED for a clear fall', () => {
    const result = compareObservations(obs({ id: 'a', value: 30 }), obs({ id: 'b', value: 20 }));
    expect(result.direction).toBe('DECREASED');
  });

  it('reports STABLE for a change within the noise threshold', () => {
    const result = compareObservations(obs({ id: 'a', value: 100 }), obs({ id: 'b', value: 100.5 }));
    expect(result.direction).toBe('STABLE');
  });

  it('never produces a change result without a deterministic method attached', () => {
    const result = compareObservations(obs({ id: 'a' }), obs({ id: 'b', value: 25 }));
    expect(result.method).toBeTruthy();
    expect(result.observationIdA).toBe('a');
    expect(result.observationIdB).toBe('b');
  });
});
