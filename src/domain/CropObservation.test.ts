import { describe, expect, it } from 'vitest';
import { createCropObservation } from './CropObservation';

describe('createCropObservation', () => {
  it('requires a fieldId', () => {
    expect(() => createCropObservation({ fieldId: '', source: 'USER_REPORTED' })).toThrow(/requires a fieldId/);
  });

  it('rejects an out-of-range confidence', () => {
    expect(() => createCropObservation({ fieldId: 'f1', source: 'USER_REPORTED', confidence: 1.5 })).toThrow(/out-of-range confidence/);
  });

  it('defaults growthStage to UNKNOWN and leaves observedCondition null rather than inventing a value', () => {
    const obs = createCropObservation({ fieldId: 'f1', source: 'USER_REPORTED' });
    expect(obs.growthStage).toBe('UNKNOWN');
    expect(obs.observedCondition).toBeNull();
  });

  it('preserves the provided source as provenance, not fabricated', () => {
    const obs = createCropObservation({ fieldId: 'f1', source: 'USER_REPORTED', observedCondition: 'yellowing on lower leaves' });
    expect(obs.source).toBe('USER_REPORTED');
    expect(obs.observedCondition).toBe('yellowing on lower leaves');
  });
});
