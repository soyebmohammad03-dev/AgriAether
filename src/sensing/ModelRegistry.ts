import { createId } from '../domain/id';

export type ModelTask =
  | 'CROP_SEGMENTATION'
  | 'CROP_STRESS_CLASSIFICATION'
  | 'DISEASE_CLASSIFICATION'
  | 'YIELD_ESTIMATION'
  | 'IRRIGATION_DEMAND'
  | 'NUTRIENT_STATUS';
export type ModelDeploymentStatus = 'NOT_DEPLOYED' | 'STAGED' | 'DEPLOYED';

/**
 * A registry entry for an ML model — data only, never model weights or
 * inference code. Part 17 of the Phase 4 brief is explicit: this project
 * has no labeled agricultural dataset, so nothing here is DEPLOYED, and no
 * model produces a real prediction yet. Registering a model's contract is
 * still useful now: it's the interface the first real model will implement,
 * and `assertModelRecord` enforces the one rule that matters before that
 * day comes — a model cannot claim DEPLOYED without evaluation metrics to
 * back it up.
 */
export interface ModelRecord {
  id: string;
  name: string;
  version: string;
  task: ModelTask;
  inputRequirements: string;
  outputType: string;
  /** Observation/field types the model consumes — the contract's feature list, never inferred at inference time. */
  featureSchema: string[];
  trainingDatasetRef: string | null;
  datasetVersion: string | null;
  trainedAt: number | null;
  evaluatedAt: number | null;
  evaluationMetrics: Record<string, number> | null;
  deploymentStatus: ModelDeploymentStatus;
  limitations: string;
  confidenceCalibration: string | null;
}

/** Minimum evaluation metrics a DEPLOYED model must report — deliberately conservative, not a statistical guarantee. */
const MIN_DEPLOYABLE_METRIC_COUNT = 1;

export function assertModelRecordValid(model: ModelRecord): void {
  if (model.deploymentStatus === 'DEPLOYED' && (!model.evaluationMetrics || Object.keys(model.evaluationMetrics).length < MIN_DEPLOYABLE_METRIC_COUNT)) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without evaluation metrics`);
  }
  if (model.deploymentStatus === 'DEPLOYED' && !model.trainingDatasetRef) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without a training dataset reference`);
  }
  if (model.deploymentStatus === 'DEPLOYED' && !model.datasetVersion) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without a dataset version`);
  }
  if (model.deploymentStatus === 'DEPLOYED' && model.featureSchema.length === 0) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without a declared feature schema`);
  }
  if (model.deploymentStatus === 'DEPLOYED' && (model.trainedAt === null || model.evaluatedAt === null)) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without recorded training/evaluation timestamps`);
  }
}

export function createModelRecord(params: {
  name: string;
  version: string;
  task: ModelTask;
  inputRequirements: string;
  outputType: string;
  featureSchema?: string[];
  trainingDatasetRef?: string | null;
  datasetVersion?: string | null;
  trainedAt?: number | null;
  evaluatedAt?: number | null;
  evaluationMetrics?: Record<string, number> | null;
  deploymentStatus?: ModelDeploymentStatus;
  limitations: string;
  confidenceCalibration?: string | null;
}): ModelRecord {
  const model: ModelRecord = {
    id: createId('model'),
    name: params.name,
    version: params.version,
    task: params.task,
    inputRequirements: params.inputRequirements,
    outputType: params.outputType,
    featureSchema: params.featureSchema ?? [],
    trainingDatasetRef: params.trainingDatasetRef ?? null,
    datasetVersion: params.datasetVersion ?? null,
    trainedAt: params.trainedAt ?? null,
    evaluatedAt: params.evaluatedAt ?? null,
    evaluationMetrics: params.evaluationMetrics ?? null,
    deploymentStatus: params.deploymentStatus ?? 'NOT_DEPLOYED',
    limitations: params.limitations,
    confidenceCalibration: params.confidenceCalibration ?? null
  };
  assertModelRecordValid(model);
  return model;
}

/**
 * Provenance record for one prediction request — logged whether or not a
 * prediction was actually produced, so "why didn't this field get a yield
 * number" is always answerable from data already on hand.
 */
export interface PredictionRecord {
  id: string;
  modelId: string;
  modelVersion: string;
  task: ModelTask;
  fieldId: string;
  zoneId: string | null;
  status: 'PREDICTED' | 'NOT_AVAILABLE';
  value: number | null;
  confidence: number | null;
  reason: string | null;
  inputObservationIds: string[];
  requestedAt: number;
}

export function createPredictionRecord(params: {
  model: ModelRecord;
  fieldId: string;
  zoneId?: string | null;
  status: 'PREDICTED' | 'NOT_AVAILABLE';
  value?: number | null;
  confidence?: number | null;
  reason?: string | null;
  inputObservationIds?: string[];
}): PredictionRecord {
  return {
    id: createId('prediction'),
    modelId: params.model.id,
    modelVersion: params.model.version,
    task: params.model.task,
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    status: params.status,
    value: params.value ?? null,
    confidence: params.confidence ?? null,
    reason: params.reason ?? null,
    inputObservationIds: params.inputObservationIds ?? [],
    requestedAt: Date.now()
  };
}

/**
 * The models AgriAether's registry anticipates — every one NOT_DEPLOYED
 * because no labeled agricultural dataset exists in this repository yet.
 * Registering the contract now means the first real model has an interface
 * to implement instead of one invented under deadline pressure later.
 */
export interface DatasetReadinessCheck {
  task: ModelTask;
  status: 'READY' | 'INSUFFICIENT_DATA';
  reasons: string[];
  labeledSampleCount: number;
  minLabeledSamples: number;
}

/**
 * Checks whether a real labeled dataset exists for a planned model, rather
 * than either faking readiness or leaving it undocumented. `labeledSampleCount`
 * must come from an actual count of agronomist-verified labels — this
 * codebase has no such label taxonomy (CropObservation.observedCondition is
 * free text, not a validated class), so calling this with a real count from
 * the current world always yields 0 today. `minLabeledSamples` is a
 * documented, deliberately conservative floor (not derived from any
 * statistical power calculation) below which training would be scientific
 * malpractice, not just "not yet optimal."
 */
export function assessDatasetReadiness(task: ModelTask, labeledSampleCount: number, minLabeledSamples = 50): DatasetReadinessCheck {
  const reasons: string[] = [];
  if (labeledSampleCount < minLabeledSamples) {
    reasons.push(
      `${labeledSampleCount} labeled sample(s) available for ${task}; at least ${minLabeledSamples} are required before training is defensible. CropObservation.observedCondition is free text, not a validated label taxonomy — no automated labeling exists in this codebase.`
    );
  }
  return {
    task,
    status: reasons.length === 0 ? 'READY' : 'INSUFFICIENT_DATA',
    reasons,
    labeledSampleCount,
    minLabeledSamples
  };
}

export const PLANNED_MODELS: ModelRecord[] = [
  createModelRecord({
    name: 'Crop Segmentation (planned)',
    version: '0.0.0-unimplemented',
    task: 'CROP_SEGMENTATION',
    inputRequirements: 'RGB or multispectral orthomosaic tiles with known ground sample distance',
    outputType: 'Per-pixel crop/non-crop mask',
    featureSchema: ['imagery.rgb', 'imagery.multispectral'],
    limitations: 'No training dataset exists in this repository. Requires labeled imagery from a real or high-fidelity simulated field before training can begin.'
  }),
  createModelRecord({
    name: 'Crop Stress Classification (planned)',
    version: '0.0.0-unimplemented',
    task: 'CROP_STRESS_CLASSIFICATION',
    inputRequirements: 'Multispectral vegetation indices + thermal features + soil moisture, temporally aligned',
    outputType: 'Stress class with confidence',
    featureSchema: ['vegetation_index.ndvi', 'soil.moisture', 'thermal.surface_temperature'],
    limitations: 'No labeled ground-truth stress dataset exists. Requires paired imagery + agronomist-verified stress labels.'
  }),
  createModelRecord({
    name: 'Disease Classification (planned)',
    version: '0.0.0-unimplemented',
    task: 'DISEASE_CLASSIFICATION',
    inputRequirements: 'High-resolution RGB imagery of individual plants/leaves',
    outputType: 'Disease class with confidence',
    featureSchema: ['imagery.rgb'],
    limitations: 'No disease-labeled dataset exists. This is explicitly NOT implemented — see the Phase 4 scientific-honesty constraints in the README. DiseasePestSignal.ts is a rule-based risk-factor screen, not this model.'
  }),
  createModelRecord({
    name: 'Yield Estimation (planned)',
    version: '0.0.0-unimplemented',
    task: 'YIELD_ESTIMATION',
    inputRequirements: 'Multi-temporal vegetation indices across a full growing season + known crop type/planting date',
    outputType: 'Estimated yield with a prediction interval',
    featureSchema: ['vegetation_index.ndvi', 'domain.crop_cycle'],
    limitations: 'No historical yield ground truth exists in this repository, and no CropCycle in the seeded demo world has a known crop type or planting date.'
  }),
  createModelRecord({
    name: 'Irrigation Demand Prediction (planned)',
    version: '0.0.0-unimplemented',
    task: 'IRRIGATION_DEMAND',
    inputRequirements: 'Soil moisture time series + rainfall + crop growth stage + evapotranspiration parameters',
    outputType: 'Predicted water demand (volume/area) over a horizon',
    featureSchema: ['soil.moisture', 'weather.daily_precipitation', 'weather.daily_temp_max', 'domain.crop_cycle'],
    limitations: 'No calibrated evapotranspiration/crop-coefficient model exists in this repository. IrrigationIntelligence.ts provides a rule-based need screen, never a litres/hectare figure.'
  }),
  createModelRecord({
    name: 'Nutrient Status Prediction (planned)',
    version: '0.0.0-unimplemented',
    task: 'NUTRIENT_STATUS',
    inputRequirements: 'Soil N/P/K time series + crop type + growth stage + regional calibration curve',
    outputType: 'Predicted nutrient sufficiency class',
    featureSchema: ['soil.nitrogen', 'soil.phosphorus', 'soil.potassium', 'domain.crop_cycle'],
    limitations: 'No regionally-calibrated sufficiency curve exists in this repository. NutrientIntelligence.ts reports measured completeness/status only, never a fertilizer rate.'
  })
];
