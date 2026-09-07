import { describe, expect, it } from 'vitest';
import { requestPrediction } from './AgriculturalPrediction';
import { createModelRecord } from './ModelRegistry';

describe('requestPrediction', () => {
  it('returns NOT_AVAILABLE with a reason for a NOT_DEPLOYED model, never a fabricated value', () => {
    const model = createModelRecord({
      name: 'Yield (planned)',
      version: '0.0.0-unimplemented',
      task: 'YIELD_ESTIMATION',
      inputRequirements: 'x',
      outputType: 'y',
      featureSchema: ['vegetation_index.ndvi'],
      limitations: 'no dataset'
    });
    const result = requestPrediction({ model, fieldId: 'f', availableFeatureTypes: ['vegetation_index.ndvi'] });
    expect(result.status).toBe('NOT_AVAILABLE');
    expect(result.value).toBeNull();
    expect(result.reason).toMatch(/NOT_DEPLOYED/);
  });
});
