import type { ModelRecord } from './ModelRegistry';
import { createPredictionRecord, type PredictionRecord } from './ModelRegistry';

/**
 * The single entry point any caller uses to ask for a prediction. Every
 * PLANNED_MODELS entry is NOT_DEPLOYED (no labeled dataset exists in this
 * repository — see ModelRegistry.ts), so this always returns NOT_AVAILABLE
 * today, citing exactly which requirement is unmet. The contract exists so
 * the first real model has a call site to plug into instead of one invented
 * under deadline pressure, and so no caller can accidentally fabricate a
 * number when a model isn't ready.
 */
export function requestPrediction(params: {
  model: ModelRecord;
  fieldId: string;
  zoneId?: string | null;
  availableFeatureTypes: string[];
}): PredictionRecord {
  const { model } = params;

  if (model.deploymentStatus !== 'DEPLOYED') {
    return createPredictionRecord({
      model,
      fieldId: params.fieldId,
      zoneId: params.zoneId,
      status: 'NOT_AVAILABLE',
      reason: `Model "${model.name}" is ${model.deploymentStatus}, not DEPLOYED. ${model.limitations}`
    });
  }

  const missingFeatures = model.featureSchema.filter((f) => !params.availableFeatureTypes.includes(f));
  if (missingFeatures.length > 0) {
    return createPredictionRecord({
      model,
      fieldId: params.fieldId,
      zoneId: params.zoneId,
      status: 'NOT_AVAILABLE',
      reason: `Missing required feature(s) for this field/zone: ${missingFeatures.join(', ')}`
    });
  }

  // No DEPLOYED model exists yet in this codebase (assertModelRecordValid
  // enforces evaluation evidence before DEPLOYED is even reachable), so
  // there is no real inference path to call here. Left as an explicit
  // NOT_AVAILABLE rather than a stub prediction — never fabricate a value.
  return createPredictionRecord({
    model,
    fieldId: params.fieldId,
    zoneId: params.zoneId,
    status: 'NOT_AVAILABLE',
    reason: 'No inference implementation exists for a DEPLOYED model of this task yet.'
  });
}
