import { describe, expect, it } from 'vitest';
import { createCropObservation } from './CropObservation';
import { compareCropObservations, summarizeFieldCropStatus } from './CropStatusChange';

describe('compareCropObservations', () => {
  it('reports ADVANCED when growth stage moves forward, regardless of input order', () => {
    const early = createCropObservation({ fieldId: 'f', growthStage: 'EMERGENCE', timestamp: 1000, source: 'USER_REPORTED' });
    const later = createCropObservation({ fieldId: 'f', growthStage: 'VEGETATIVE', timestamp: 2000, source: 'USER_REPORTED' });
    expect(compareCropObservations(later, early).progression).toBe('ADVANCED');
    expect(compareCropObservations(early, later).progression).toBe('ADVANCED');
  });

  it('reports REGRESSED and UNCHANGED correctly', () => {
    const a = createCropObservation({ fieldId: 'f', growthStage: 'FLOWERING', timestamp: 1000, source: 'USER_REPORTED' });
    const b = createCropObservation({ fieldId: 'f', growthStage: 'VEGETATIVE', timestamp: 2000, source: 'USER_REPORTED' });
    const c = createCropObservation({ fieldId: 'f', growthStage: 'VEGETATIVE', timestamp: 3000, source: 'USER_REPORTED' });
    expect(compareCropObservations(a, b).progression).toBe('REGRESSED');
    expect(compareCropObservations(b, c).progression).toBe('UNCHANGED');
  });

  it('reports UNKNOWN when either stage is UNKNOWN, never fabricating an order', () => {
    const a = createCropObservation({ fieldId: 'f', timestamp: 1000, source: 'UNKNOWN' }); // defaults to UNKNOWN stage
    const b = createCropObservation({ fieldId: 'f', growthStage: 'VEGETATIVE', timestamp: 2000, source: 'USER_REPORTED' });
    expect(compareCropObservations(a, b).progression).toBe('UNKNOWN');
  });

  it('reports UNKNOWN for observations from different fields', () => {
    const a = createCropObservation({ fieldId: 'f1', growthStage: 'PLANTED', timestamp: 1000, source: 'USER_REPORTED' });
    const b = createCropObservation({ fieldId: 'f2', growthStage: 'VEGETATIVE', timestamp: 2000, source: 'USER_REPORTED' });
    expect(compareCropObservations(a, b).progression).toBe('UNKNOWN');
  });
});

describe('summarizeFieldCropStatus', () => {
  it('returns an honest empty summary when no observations exist', () => {
    const summary = summarizeFieldCropStatus('f', []);
    expect(summary.observationCount).toBe(0);
    expect(summary.recentComparison).toBeNull();
  });

  it('includes a comparison only when 2+ observations exist for the field', () => {
    const a = createCropObservation({ fieldId: 'f', growthStage: 'PLANTED', timestamp: 1000, source: 'USER_REPORTED' });
    const single = summarizeFieldCropStatus('f', [a]);
    expect(single.observationCount).toBe(1);
    expect(single.recentComparison).toBeNull();

    const b = createCropObservation({ fieldId: 'f', growthStage: 'EMERGENCE', timestamp: 2000, source: 'USER_REPORTED' });
    const pair = summarizeFieldCropStatus('f', [a, b]);
    expect(pair.observationCount).toBe(2);
    expect(pair.recentComparison?.progression).toBe('ADVANCED');
    expect(pair.latestGrowthStage).toBe('EMERGENCE');
  });
});
