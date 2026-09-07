import { createId } from '../domain/id';

export type ModelTask = 'CROP_SEGMENTATION' | 'CROP_STRESS_CLASSIFICATION' | 'DISEASE_CLASSIFICATION' | 'YIELD_ESTIMATION';
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
  trainingDatasetRef: string | null;
  evaluationMetrics: Record<string, number> | null;
  deploymentStatus: ModelDeploymentStatus;
  limitations: string;
  confidenceCalibration: string | null;
}

export function assertModelRecordValid(model: ModelRecord): void {
  if (model.deploymentStatus === 'DEPLOYED' && (!model.evaluationMetrics || Object.keys(model.evaluationMetrics).length === 0)) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without evaluation metrics`);
  }
  if (model.deploymentStatus === 'DEPLOYED' && !model.trainingDatasetRef) {
    throw new Error(`Model "${model.id}" cannot be DEPLOYED without a training dataset reference`);
  }
}

export function createModelRecord(params: {
  name: string;
  version: string;
  task: ModelTask;
  inputRequirements: string;
  outputType: string;
  trainingDatasetRef?: string | null;
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
    trainingDatasetRef: params.trainingDatasetRef ?? null,
    evaluationMetrics: params.evaluationMetrics ?? null,
    deploymentStatus: params.deploymentStatus ?? 'NOT_DEPLOYED',
    limitations: params.limitations,
    confidenceCalibration: params.confidenceCalibration ?? null
  };
  assertModelRecordValid(model);
  return model;
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
    limitations: 'No training dataset exists in this repository. Requires labeled imagery from a real or high-fidelity simulated field before training can begin.'
  }),
  createModelRecord({
    name: 'Crop Stress Classification (planned)',
    version: '0.0.0-unimplemented',
    task: 'CROP_STRESS_CLASSIFICATION',
    inputRequirements: 'Multispectral vegetation indices + thermal features + soil moisture, temporally aligned',
    outputType: 'Stress class with confidence',
    limitations: 'No labeled ground-truth stress dataset exists. Requires paired imagery + agronomist-verified stress labels.'
  }),
  createModelRecord({
    name: 'Disease Classification (planned)',
    version: '0.0.0-unimplemented',
    task: 'DISEASE_CLASSIFICATION',
    inputRequirements: 'High-resolution RGB imagery of individual plants/leaves',
    outputType: 'Disease class with confidence',
    limitations: 'No disease-labeled dataset exists. This is explicitly NOT implemented — see the Phase 4 scientific-honesty constraints in the README.'
  }),
  createModelRecord({
    name: 'Yield Estimation (planned)',
    version: '0.0.0-unimplemented',
    task: 'YIELD_ESTIMATION',
    inputRequirements: 'Multi-temporal vegetation indices across a full growing season + known crop type/planting date',
    outputType: 'Estimated yield with a prediction interval',
    limitations: 'No historical yield ground truth exists in this repository, and no CropCycle in the seeded demo world has a known crop type or planting date.'
  })
];
