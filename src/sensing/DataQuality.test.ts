import { describe, expect, it } from 'vitest';
import { deriveDataQuality } from './DataQuality';

describe('deriveDataQuality', () => {
  it('reports MISSING when there is no value, regardless of other params', () => {
    expect(deriveDataQuality({ hasValue: false })).toBe('MISSING');
  });

  it('reports CALIBRATION_REQUIRED for an uncalibrated sensor before checking range/staleness', () => {
    expect(deriveDataQuality({ hasValue: true, calibrationStatus: 'UNCALIBRATED', value: 999, plausibleRange: { min: 0, max: 100 } })).toBe(
      'CALIBRATION_REQUIRED'
    );
  });

  it('reports STALE when age exceeds the staleness ceiling', () => {
    expect(deriveDataQuality({ hasValue: true, ageMs: 10_000, staleAfterMs: 5_000 })).toBe('STALE');
  });

  it('reports OUT_OF_RANGE when the value falls outside the plausible range', () => {
    expect(deriveDataQuality({ hasValue: true, value: 150, plausibleRange: { min: 0, max: 100 } })).toBe('OUT_OF_RANGE');
  });

  it('reports QUESTIONABLE when calibration status is unknown and value is in range', () => {
    expect(deriveDataQuality({ hasValue: true, calibrationStatus: 'UNKNOWN', value: 50, plausibleRange: { min: 0, max: 100 } })).toBe(
      'QUESTIONABLE'
    );
  });

  it('reports VALID when nothing else applies', () => {
    expect(deriveDataQuality({ hasValue: true, calibrationStatus: 'CALIBRATED', value: 50, plausibleRange: { min: 0, max: 100 } })).toBe(
      'VALID'
    );
  });
});
