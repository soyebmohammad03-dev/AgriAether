import { describe, expect, it } from 'vitest';
import { classifyFreshness, summarizeWindow, findTemporalGaps, trendDirection, compareBeforeAfter } from './TemporalIntelligence';
import type { Observation } from '../observation/Observation';

function obs(overrides: Partial<Observation<number>>): Observation<number> {
  return {
    id: 'o',
    type: 'soil.moisture',
    value: 20,
    unit: 'percent',
    timestamp: 1000,
    location: null,
    source: 'sim-sensor:soil',
    provenance: 'SIMULATED',
    confidence: 0.9,
    status: 'OK',
    fieldId: 'field_1',
    ...overrides
  };
}

describe('classifyFreshness', () => {
  it('is UNKNOWN with no observation, STALE past the threshold, CURRENT otherwise', () => {
    expect(classifyFreshness(null, 10000, 5000)).toBe('UNKNOWN');
    expect(classifyFreshness(obs({ timestamp: 0 }), 10000, 5000)).toBe('STALE');
    expect(classifyFreshness(obs({ timestamp: 9000 }), 10000, 5000)).toBe('CURRENT');
  });
});

describe('summarizeWindow', () => {
  it('returns count 0 and every stat null for an empty window, never an error', () => {
    const summary = summarizeWindow([], 'field_1', 'soil.moisture', 0, 1000);
    expect(summary.count).toBe(0);
    expect(summary.mean).toBeNull();
  });

  it('computes mean/min/max from in-window OK numeric observations only', () => {
    const summary = summarizeWindow(
      [obs({ id: 'a', timestamp: 100, value: 10 }), obs({ id: 'b', timestamp: 200, value: 30 })],
      'field_1',
      'soil.moisture',
      0,
      1000
    );
    expect(summary.count).toBe(2);
    expect(summary.mean).toBe(20);
    expect(summary.min).toBe(10);
    expect(summary.max).toBe(30);
    expect(summary.sourceObservationIds).toEqual(['a', 'b']);
  });
});

describe('findTemporalGaps', () => {
  it('reports leading, middle, and trailing gaps larger than tolerance', () => {
    const gaps = findTemporalGaps([5000, 5100], 0, 20000, 1000, 1);
    expect(gaps).toEqual([
      { startMs: 0, endMs: 5000, durationMs: 5000 },
      { startMs: 5100, endMs: 20000, durationMs: 14900 }
    ]);
  });
});

describe('trendDirection', () => {
  it('returns null with fewer than two in-window observations', () => {
    expect(trendDirection([obs({ timestamp: 100 })], 'field_1', 'soil.moisture', 0, 1000)).toBeNull();
  });

  it('compares first vs last, never a fitted regression', () => {
    const result = trendDirection(
      [obs({ id: 'a', timestamp: 100, value: 10 }), obs({ id: 'b', timestamp: 200, value: 50 })],
      'field_1',
      'soil.moisture',
      0,
      1000
    );
    expect(result?.direction).toBe('INCREASED');
    expect(result?.sampleCount).toBe(2);
  });
});

describe('compareBeforeAfter', () => {
  it('reports INSUFFICIENT_DATA when one side of the cutover has nothing', () => {
    const result = compareBeforeAfter([obs({ id: 'a', timestamp: 100, value: 10 })], 'field_1', 'soil.moisture', 500);
    expect(result.direction).toBe('INSUFFICIENT_DATA');
  });

  it('compares the latest-before against the earliest-after', () => {
    const result = compareBeforeAfter(
      [
        obs({ id: 'a', timestamp: 100, value: 10 }),
        obs({ id: 'b', timestamp: 400, value: 12 }),
        obs({ id: 'c', timestamp: 600, value: 40 })
      ],
      'field_1',
      'soil.moisture',
      500
    );
    expect(result.observationIdA).toBe('b');
    expect(result.observationIdB).toBe('c');
    expect(result.direction).toBe('INCREASED');
  });
});
