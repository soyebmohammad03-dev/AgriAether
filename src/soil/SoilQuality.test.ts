import { describe, expect, it } from 'vitest';
import { createSoilSample } from './SoilSample';
import { ecStatus, moistureStatus, phStatus, soilSampleCompleteness, summarizeSoilSampleQuality } from './SoilQuality';

describe('moistureStatus / ecStatus / phStatus boundaries', () => {
  it('classifies moisture', () => {
    expect(moistureStatus(10)).toBe('DRY');
    expect(moistureStatus(25)).toBe('ADEQUATE');
    expect(moistureStatus(40)).toBe('SATURATED');
  });

  it('classifies EC', () => {
    expect(ecStatus(0.5)).toBe('LOW');
    expect(ecStatus(1.5)).toBe('NORMAL');
    expect(ecStatus(3)).toBe('HIGH');
    expect(ecStatus(5)).toBe('SALINE');
  });

  it('classifies pH', () => {
    expect(phStatus(5)).toBe('ACIDIC');
    expect(phStatus(6)).toBe('SLIGHTLY_ACIDIC');
    expect(phStatus(7)).toBe('NEUTRAL');
    expect(phStatus(7.5)).toBe('SLIGHTLY_ALKALINE');
    expect(phStatus(8.5)).toBe('ALKALINE');
  });
});

describe('soilSampleCompleteness', () => {
  it('reports which known measurements are missing, never assuming zero', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5, moisturePercent: 20 } });
    const completeness = soilSampleCompleteness(sample);
    expect(completeness.presentCount).toBe(2);
    expect(completeness.totalKnownMeasurements).toBe(7);
    expect(completeness.missing).toContain('ec');
    expect(completeness.missing).not.toContain('ph');
  });
});

describe('summarizeSoilSampleQuality', () => {
  it('flags an out-of-range measurement without rejecting the sample', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 20 } });
    const summary = summarizeSoilSampleQuality(sample);
    expect(summary.measurementQuality.ph).toBe('OUT_OF_RANGE');
    expect(summary.hasOutOfRangeMeasurement).toBe(true);
    expect(summary.phStatus).toBeNull(); // out-of-range value gets no status classification, not a fabricated one
  });

  it('produces VALID quality and a status for an in-range measurement', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.0 } });
    const summary = summarizeSoilSampleQuality(sample);
    expect(summary.measurementQuality.ph).toBe('VALID');
    expect(summary.phStatus).toBe('SLIGHTLY_ACIDIC');
    expect(summary.hasOutOfRangeMeasurement).toBe(false);
  });

  it('leaves moisture/EC/pH status null when the measurement is absent', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { nitrogenPpm: 50 } });
    const summary = summarizeSoilSampleQuality(sample);
    expect(summary.moistureStatus).toBeNull();
    expect(summary.ecStatus).toBeNull();
    expect(summary.phStatus).toBeNull();
  });
});
