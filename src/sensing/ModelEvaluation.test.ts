import { describe, expect, it } from 'vitest';
import { createEvaluationRun } from './ModelEvaluation';
import { PLANNED_MODELS } from './ModelRegistry';

describe('createEvaluationRun', () => {
  const model = PLANNED_MODELS[0];

  it('rejects an evaluation run with no real metrics — never fabricates one', () => {
    expect(() => createEvaluationRun({ model, datasetVersion: 'v1', splitRole: 'TEST', metrics: {}, limitations: 'x' })).toThrow(/at least one real metric/);
  });

  it('rejects a run with no dataset version', () => {
    expect(() => createEvaluationRun({ model, datasetVersion: '', splitRole: 'TEST', metrics: { accuracy: 0.5 }, limitations: 'x' })).toThrow(/dataset version/);
  });

  it('records a real run with metrics supplied by the caller', () => {
    const run = createEvaluationRun({ model, datasetVersion: 'v1', splitRole: 'TEST', metrics: { accuracy: 0.5 }, limitations: 'small held-out set' });
    expect(run.metrics.accuracy).toBe(0.5);
    expect(run.modelId).toBe(model.id);
  });
});
