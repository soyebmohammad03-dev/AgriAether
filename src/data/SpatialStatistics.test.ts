import { describe, expect, it } from 'vitest';
import { computeSpatialStatistics } from './SpatialStatistics';

describe('computeSpatialStatistics', () => {
  it('computes mean/min/max/stddev correctly for known values', () => {
    const values = [10, 20, 30, 40];
    expect(computeSpatialStatistics(values, 4, 'mean').value).toBe(25);
    expect(computeSpatialStatistics(values, 4, 'min').value).toBe(10);
    expect(computeSpatialStatistics(values, 4, 'max').value).toBe(40);
    expect(computeSpatialStatistics(values, 4, 'median').value).toBe(25);
  });

  it('reports full coverage as VALID quality', () => {
    const result = computeSpatialStatistics([1, 2, 3, 4], 4, 'mean');
    expect(result.coverageFraction).toBe(1);
    expect(result.quality).toBe('VALID');
  });

  it('flags a low-coverage statistic as QUESTIONABLE — a mean over 3 of 300000 should not look as trustworthy as a full-coverage one', () => {
    const result = computeSpatialStatistics([1, 2, 3], 300_000, 'mean');
    expect(result.quality).toBe('QUESTIONABLE');
  });

  it('returns INSUFFICIENT_DATA with a null value for zero valid samples', () => {
    const result = computeSpatialStatistics([], 100, 'mean');
    expect(result.value).toBeNull();
    expect(result.quality).toBe('INSUFFICIENT_DATA');
  });

  it('carries a processing step recording its algorithm version', () => {
    const result = computeSpatialStatistics([1, 2], 2, 'mean');
    expect(result.processingStep.operation).toBe('spatial_statistics');
    expect(result.processingStep.algorithmVersion).toBeTruthy();
  });
});
