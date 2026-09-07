import type { ModelRecord, PredictionRecord } from './ModelRegistry';
import { createPredictionRecord } from './ModelRegistry';

/**
 * The TypeScript side of the Python -> versioned artifact -> TypeScript
 * boundary this milestone's brief requires (never a live PyTorch runtime in
 * the browser, never a second intelligence architecture in Python — see
 * ml/README.md). Ingests exactly the JSON shape ml/src/infer.py writes to
 * ml/artifacts/predictions.json (a copy is committed at
 * ml/manifests/sample_predictions.json as the real, reproducible fixture
 * this module's tests run against).
 *
 * Every entry is untrusted external input until validated here — same
 * discipline as data/ImportPipeline.ts's CSV/GeoJSON path: malformed
 * entries are skipped with a reason, never thrown away silently and never
 * coerced into a fabricated PredictionRecord.
 */

export interface PredictionArtifactImportResult {
  accepted: PredictionRecord[];
  skipped: Array<{ index: number; reason: string }>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateEntry(entry: unknown, index: number): { record: Record<string, unknown>; error: string | null } {
  if (typeof entry !== 'object' || entry === null) return { record: {}, error: `entry ${index} is not an object` };
  const e = entry as Record<string, unknown>;
  if (typeof e.predictionId !== 'string') return { record: e, error: `entry ${index} missing predictionId` };
  if (typeof e.inputSource !== 'string') return { record: e, error: `entry ${index} missing inputSource` };
  if (typeof e.abstained !== 'boolean') return { record: e, error: `entry ${index} missing abstained flag` };
  if (!isFiniteNumber(e.confidence)) return { record: e, error: `entry ${index} missing numeric confidence` };
  if (!e.abstained && typeof e.predictedClassId !== 'number' && typeof e.predictedClassId !== 'string') {
    return { record: e, error: `entry ${index} is not abstained but has no predictedClassId` };
  }
  return { record: e, error: null };
}

/**
 * `fieldId` is caller-supplied context (e.g. a benchmark/dataset pseudo-id
 * when these predictions are not tied to any real AgriAether field) — this
 * function never infers a live field from the artifact, and every accepted
 * record's `inputSource` is copied verbatim from the artifact (defaulting
 * to the safest value, 'UNKNOWN', for anything this parser doesn't
 * recognize) rather than ever being upgraded to `'LIVE_FIELD'` here.
 */
export function importPredictionArtifact(raw: unknown, params: { model: ModelRecord; fieldId: string; zoneId?: string | null }): PredictionArtifactImportResult {
  if (!Array.isArray(raw)) {
    return { accepted: [], skipped: [{ index: -1, reason: 'artifact root is not an array' }] };
  }

  const accepted: PredictionRecord[] = [];
  const skipped: Array<{ index: number; reason: string }> = [];

  raw.forEach((entry, index) => {
    const { record: e, error } = validateEntry(entry, index);
    if (error) {
      skipped.push({ index, reason: error });
      return;
    }

    const inputSource = e.inputSource === 'MODEL_VALIDATION_DATA' || e.inputSource === 'LIVE_FIELD' ? (e.inputSource as 'MODEL_VALIDATION_DATA' | 'LIVE_FIELD') : 'UNKNOWN';
    const abstained = e.abstained as boolean;
    const confidence = e.confidence as number;

    accepted.push(
      createPredictionRecord({
        model: params.model,
        fieldId: params.fieldId,
        zoneId: params.zoneId ?? null,
        status: abstained ? 'NOT_AVAILABLE' : 'PREDICTED',
        confidence,
        reason: abstained ? (typeof e.abstentionReason === 'string' ? e.abstentionReason : 'Model abstained below its confidence threshold.') : null,
        predictedClassId: abstained ? null : String(e.predictedClassId),
        predictedClassName: typeof e.predictedClassName === 'string' ? e.predictedClassName : null,
        probabilityDistribution: typeof e.probabilityDistribution === 'object' && e.probabilityDistribution !== null ? (e.probabilityDistribution as Record<string, number>) : null,
        abstained,
        abstentionReason: typeof e.abstentionReason === 'string' ? e.abstentionReason : null,
        datasetVersion: typeof e.inputDataset === 'string' ? e.inputDataset : null,
        inputSource
      })
    );
  });

  return { accepted, skipped };
}
