import { describe, expect, it } from 'vitest';
import { assessDatasetReadiness, createModelRecord, createPredictionRecord, PLANNED_MODELS } from './ModelRegistry';

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

  it('rejects a model claiming DEPLOYED without a feature schema, dataset version, or train/eval timestamps', () => {
    expect(() =>
      createModelRecord({
        name: 'Untested Model',
        version: '1.0.0',
        task: 'CROP_STRESS_CLASSIFICATION',
        inputRequirements: 'x',
        outputType: 'y',
        evaluationMetrics: { accuracy: 0.9 },
        trainingDatasetRef: 'dataset://example',
        datasetVersion: 'v1',
        deploymentStatus: 'DEPLOYED',
        limitations: 'none documented'
      })
    ).toThrow(/feature schema/);
  });

  it('accepts a DEPLOYED model that has metrics, dataset provenance, a feature schema, and train/eval timestamps', () => {
    expect(() =>
      createModelRecord({
        name: 'Fully Evaluated Model',
        version: '1.0.0',
        task: 'CROP_STRESS_CLASSIFICATION',
        inputRequirements: 'x',
        outputType: 'y',
        featureSchema: ['soil.moisture'],
        evaluationMetrics: { accuracy: 0.9 },
        trainingDatasetRef: 'dataset://example',
        datasetVersion: 'v1',
        trainedAt: 1000,
        evaluatedAt: 2000,
        deploymentStatus: 'DEPLOYED',
        limitations: 'validated only on the referenced dataset'
      })
    ).not.toThrow();
  });
});

describe('createPredictionRecord', () => {
  it('records NOT_AVAILABLE with a reason rather than fabricating a value for a NOT_DEPLOYED model', () => {
    const model = PLANNED_MODELS.find((m) => m.task === 'YIELD_ESTIMATION')!;
    const prediction = createPredictionRecord({ model, fieldId: 'f', status: 'NOT_AVAILABLE', reason: 'model not deployed' });
    expect(prediction.status).toBe('NOT_AVAILABLE');
    expect(prediction.value).toBeNull();
    expect(prediction.modelId).toBe(model.id);
  });
});

describe('assessDatasetReadiness', () => {
  it('reports INSUFFICIENT_DATA with a specific reason when labeled samples are below the floor', () => {
    const check = assessDatasetReadiness('CROP_STRESS_CLASSIFICATION', 0);
    expect(check.status).toBe('INSUFFICIENT_DATA');
    expect(check.reasons[0]).toMatch(/0 labeled sample/);
  });

  it('reports READY once the labeled sample count meets the floor', () => {
    const check = assessDatasetReadiness('CROP_STRESS_CLASSIFICATION', 100, 50);
    expect(check.status).toBe('READY');
    expect(check.reasons).toHaveLength(0);
  });
});
