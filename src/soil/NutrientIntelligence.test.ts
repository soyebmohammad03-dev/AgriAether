import { describe, expect, it } from 'vitest';
import { summarizeNutrientEvidence, nitrogenStatus } from './NutrientIntelligence';
import { createSoilSample } from './SoilSample';

describe('nitrogenStatus', () => {
  it('classifies below-floor ppm as LOW', () => {
    expect(nitrogenStatus(5)).toBe('LOW');
  });
});

describe('summarizeNutrientEvidence', () => {
  it('reports all three nutrients missing when no sample exists', () => {
    const summary = summarizeNutrientEvidence({ fieldId: 'f', latestSample: null, observations: [] });
    expect(summary.nitrogen).toBeNull();
    expect(summary.missing).toEqual(['nitrogen', 'phosphorus', 'potassium']);
  });

  it('reports a reading and status for a present measurement, and leaves absent ones missing', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'FIELD_SAMPLING', measurements: { nitrogenPpm: 10 } });
    const summary = summarizeNutrientEvidence({ fieldId: 'f', latestSample: sample, observations: [] });
    expect(summary.nitrogen).toEqual({ value: 10, status: 'LOW', sampleId: sample.id });
    expect(summary.missing).toEqual(['phosphorus', 'potassium']);
  });
});
