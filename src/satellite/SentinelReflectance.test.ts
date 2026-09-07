import { describe, expect, it } from 'vitest';
import { dnToReflectance, processingBaselineHasOffset } from './SentinelReflectance';

describe('processingBaselineHasOffset', () => {
  it('is true for baseline >= 04.00', () => {
    expect(processingBaselineHasOffset('05.11')).toBe(true);
    expect(processingBaselineHasOffset('04.00')).toBe(true);
  });

  it('is false for an earlier baseline or unknown', () => {
    expect(processingBaselineHasOffset('03.01')).toBe(false);
    expect(processingBaselineHasOffset(null)).toBe(false);
  });
});

describe('dnToReflectance', () => {
  it('returns null for a raw DN of exactly 0 (nodata sentinel), never a fabricated 0.0 reflectance', () => {
    expect(dnToReflectance(0, '05.11')).toBeNull();
  });

  it('applies the -1000 BOA offset for baseline >= 04.00', () => {
    // DN 2000, baseline 05.11 -> (2000 - 1000) / 10000 = 0.1
    expect(dnToReflectance(2000, '05.11')).toBeCloseTo(0.1, 6);
  });

  it('does not apply the offset for an earlier baseline', () => {
    // DN 2000, baseline 02.10 -> 2000 / 10000 = 0.2
    expect(dnToReflectance(2000, '02.10')).toBeCloseTo(0.2, 6);
  });

  it('treats a missing baseline as pre-offset (never assumes the offset applies)', () => {
    expect(dnToReflectance(2000, null)).toBeCloseTo(0.2, 6);
  });
});
