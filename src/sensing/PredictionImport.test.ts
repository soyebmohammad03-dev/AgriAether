import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importPredictionArtifact } from './PredictionImport';
import { TRAINED_MODELS } from './ModelRegistry';

const SAMPLE_ARTIFACT_PATH = resolve(__dirname, '../../ml/manifests/sample_predictions.json');
const model = TRAINED_MODELS.find((m) => m.task === 'CROP_TYPE_CLASSIFICATION')!;

describe('importPredictionArtifact (real Python-produced fixture)', () => {
  it('parses the real ml/manifests/sample_predictions.json artifact from the actual trained model run', () => {
    const raw = JSON.parse(readFileSync(SAMPLE_ARTIFACT_PATH, 'utf-8'));
    const result = importPredictionArtifact(raw, { model, fieldId: 'benchmark:multi-temporal-crop-classification' });

    expect(result.skipped).toHaveLength(0);
    expect(result.accepted.length).toBeGreaterThan(0);
    expect(result.accepted.length).toBe(raw.length);

    for (const record of result.accepted) {
      expect(record.inputSource).toBe('MODEL_VALIDATION_DATA');
      expect(record.modelId).toBe(model.id);
      expect(['PREDICTED', 'NOT_AVAILABLE']).toContain(record.status);
      if (record.abstained) {
        expect(record.status).toBe('NOT_AVAILABLE');
        expect(record.predictedClassId).toBeNull();
      } else {
        expect(record.status).toBe('PREDICTED');
        expect(record.predictedClassId).not.toBeNull();
      }
    }
  });

  it('never marks an imported artifact prediction as LIVE_FIELD', () => {
    const raw = JSON.parse(readFileSync(SAMPLE_ARTIFACT_PATH, 'utf-8'));
    const result = importPredictionArtifact(raw, { model, fieldId: 'benchmark' });
    expect(result.accepted.every((r) => r.inputSource !== 'LIVE_FIELD')).toBe(true);
  });
});

describe('importPredictionArtifact (malformed input handling)', () => {
  it('rejects a non-array root without throwing', () => {
    const result = importPredictionArtifact({ not: 'an array' }, { model, fieldId: 'f' });
    expect(result.accepted).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/not an array/);
  });

  it('skips a malformed entry (missing required fields) rather than fabricating a PredictionRecord', () => {
    const result = importPredictionArtifact([{ predictionId: 'x' }], { model, fieldId: 'f' });
    expect(result.accepted).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});
