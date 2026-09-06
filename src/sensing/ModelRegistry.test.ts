import { describe, expect, it } from 'vitest';
import { createModelRecord, PLANNED_MODELS } from './ModelRegistry';

describe('ModelRegistry', () => {
  it('every planned model is NOT_DEPLOYED — no fake model is presented as production-ready', () => {
    expect(PLANNED_MODELS.length).toBeGreaterThan(0);
    for (const model of PLANNED_MODELS) {
      expect(model.deploymentStatus).toBe('NOT_DEPLOYED');
      expect(model.limitations.length).toBeGreaterThan(0);
    }
  });

  it('rejects a model claiming DEPLOYED without evaluation metrics', () => {
    expect(() =>
      createModelRecord({
        name: 'Untested Model',
        version: '1.0.0',
        task: 'CROP_STRESS_CLASSIFICATION',
        inputRequirements: 'x',
        outputType: 'y',
        deploymentStatus: 'DEPLOYED',
        limitations: 'none documented'
      })
    ).toThrow(/evaluation metrics/);
  });

  it('rejects a model claiming DEPLOYED without a training dataset reference', () => {
    expect(() =>
      createModelRecord({
        name: 'Untested Model',
        version: '1.0.0',
        task: 'CROP_STRESS_CLASSIFICATION',
        inputRequirements: 'x',
        outputType: 'y',
        evaluationMetrics: { accuracy: 0.9 },
        deploymentStatus: 'DEPLOYED',
        limitations: 'none documented'
      })
    ).toThrow(/training dataset/);
  });

  it('accepts a DEPLOYED model that has both metrics and a dataset reference', () => {
    expect(() =>
      createModelRecord({
        name: 'Fully Evaluated Model',
        version: '1.0.0',
        task: 'CROP_STRESS_CLASSIFICATION',
        inputRequirements: 'x',
        outputType: 'y',
        evaluationMetrics: { accuracy: 0.9 },
        trainingDatasetRef: 'dataset://example',
        deploymentStatus: 'DEPLOYED',
        limitations: 'validated only on the referenced dataset'
      })
    ).not.toThrow();
  });
});
