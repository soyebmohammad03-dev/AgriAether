import { describe, expect, it } from 'vitest';
import { aggregateObservations } from './SpatialAggregation';
import type { Observation } from '../observation/Observation';

function obs(value: number, id: string): Observation<number> {
  return {
    id,
    type: 'soil.moisture',
    value,
    unit: 'percent',
    timestamp: Date.now(),
    location: null,
    source: 'sensor:s1',
    provenance: 'MEASURED',
    confidence: null,
    status: 'OK',
    zoneId: 'zone_a'
  };
}

describe('aggregateObservations', () => {
  it('computes the mean over several observations', () => {
    const result = aggregateObservations([obs(10, 'a'), obs(20, 'b'), obs(30, 'c')], 'mean');
    expect(result.value).toBe(20);
    expect(result.sampleCount).toBe(3);
    expect(result.sourceObservationIds).toEqual(['a', 'b', 'c']);
  });

  it('computes min and max', () => {
    expect(aggregateObservations([obs(10, 'a'), obs(30, 'b')], 'min').value).toBe(10);
    expect(aggregateObservations([obs(10, 'a'), obs(30, 'b')], 'max').value).toBe(30);
  });

  it('never conflates a raw reading with the aggregated statistic — the result has its own id and no "raw" flag', () => {
    const result = aggregateObservations([obs(10, 'a')], 'mean');
    expect(result.id).not.toBe('a');
    expect(result.sourceObservationIds).toContain('a');
  });

  it('rejects aggregating observations of different types', () => {
    const mixed = obs(5, 'x');
    (mixed as { type: string }).type = 'soil.ph';
    expect(() => aggregateObservations([obs(10, 'a'), mixed], 'mean')).toThrow(/different types/);
  });

  it('rejects an empty set', () => {
    expect(() => aggregateObservations([], 'mean')).toThrow(/empty/);
  });
});
