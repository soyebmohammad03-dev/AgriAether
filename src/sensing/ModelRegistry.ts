import { createId } from '../domain/id';

export type ModelTask =
  | 'CROP_SEGMENTATION'
  | 'CROP_STRESS_CLASSIFICATION'
  | 'DISEASE_CLASSIFICATION'
  | 'YIELD_ESTIMATION'
  | 'IRRIGATION_DEMAND'
  | 'NUTRIENT_STATUS'
  | 'CROP_TYPE_CLASSIFICATION'
  | 'CROP_VS_NONCROP_CLASSIFICATION';
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
/**
 * Where the input to this prediction actually came from — the structural
 * enforcement of the Push 2 domain-shift rule: a prediction run against a
 * benchmark/validation chip must never be silently presented as applicable
 * to a live AgriAether field. `LIVE_FIELD` is only ever used once a real
 * pipeline (e.g. satellite/SentinelFieldPipeline.ts output, reformatted to
 * a model's actual input contract) has genuinely fed the model — this
 * repository has none yet (see ml/README.md), so no PredictionRecord in
 * this codebase should claim it today.
 */
export type PredictionInputSource = 'LIVE_FIELD' | 'MODEL_VALIDATION_DATA' | 'UNKNOWN';

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
  /** Classification-specific fields — null/empty for a numeric-value prediction (e.g. yield estimation) or any NOT_AVAILABLE result. */
  predictedClassId: string | null;
  predictedClassName: string | null;
  probabilityDistribution: Record<string, number> | null;
  /** True when confidence fell below the model's abstention threshold and no class was forced — see ModelRecord.confidenceCalibration for the threshold, when documented. */
  abstained: boolean;
  abstentionReason: string | null;
  datasetVersion: string | null;
  /** See PredictionInputSource — defaults 'UNKNOWN' so a caller must deliberately assert LIVE_FIELD rather than getting it for free. */
  inputSource: PredictionInputSource;
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
  predictedClassId?: string | null;
  predictedClassName?: string | null;
  probabilityDistribution?: Record<string, number> | null;
  abstained?: boolean;
  abstentionReason?: string | null;
  datasetVersion?: string | null;
  inputSource?: PredictionInputSource;
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
    requestedAt: Date.now(),
    predictedClassId: params.predictedClassId ?? null,
    predictedClassName: params.predictedClassName ?? null,
    probabilityDistribution: params.probabilityDistribution ?? null,
    abstained: params.abstained ?? false,
    abstentionReason: params.abstentionReason ?? null,
    datasetVersion: params.datasetVersion ?? null,
    inputSource: params.inputSource ?? 'UNKNOWN'
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

/**
 * Models that are genuinely trained and evaluated — distinct from
 * PLANNED_MODELS (which are, by definition, never deployed). This array
 * has exactly one entry: a real, frozen Prithvi-EO-2.0-tiny-TL encoder
 * (Apache-2.0, ibm-nasa-geospatial) plus a real trained linear head, on a
 * binary Crop-vs-Non-Crop task (368 real training chips / 73 real
 * held-out validation chips, purity-filtered ≥0.6 from a verified
 * 1,600-train/151-validation download of
 * ibm-nasa-geospatial/multi-temporal-crop-classification, CC-BY-4.0,
 * using the dataset's own official split). This is the *second* version
 * of this entry — an earlier 13-class run scored 35% validation accuracy;
 * a full ML-quality audit found the bottleneck was chip-level label
 * noise, not the model, and redesigned the task to binary Crop-vs-
 * Non-Crop. Two follow-up capacity experiments (a 100M-parameter frozen
 * encoder, and partial fine-tuning of its last block) did not beat this
 * result and are NOT represented here — see ml/README.md's audit trail.
 * See ml/manifests/ for the full reproducibility record (checksums,
 * config, metrics) this entry's fields are copied from — never invented
 * here.
 *
 * `deploymentStatus: 'STAGED'`, not `'DEPLOYED'`: the structural DEPLOYED
 * gate (assertModelRecordValid) would actually be satisfied by this
 * model's real artifact/metrics/timestamps (93.15% validation accuracy,
 * well above the 57.53% majority baseline), but AgriAether's live
 * Sentinel-2 pipeline does not yet supply this model's required 6-band/
 * 3-timestep input — no live field has ever been fed to this model, so no
 * live-field accuracy claim can honestly be made. STAGED reflects "real,
 * strongly evaluated on its benchmark, not yet validated for live-field
 * deployment."
 */
export const TRAINED_MODELS: ModelRecord[] = [
  createModelRecord({
    name: 'AgriAether Crop vs. Non-Crop Classification (Prithvi-EO-2.0-tiny-TL, chip-level)',
    version: '6a74db058704',
    task: 'CROP_VS_NONCROP_CLASSIFICATION',
    inputRequirements: 'HLS 6-band (Blue/Green/Red/NIR/SWIR1/SWIR2) surface reflectance, 3 timesteps across a growing season, 224x224px @ 30m — see ml/manifests/model_manifest.json. AgriAether\'s live Sentinel-2 pipeline (satellite/SentinelRasterBuilder.ts) currently fetches only RED+NIR at a single date, so no live field can feed this model\'s real input contract yet.',
    outputType: 'Chip-level binary Crop/Non-Crop prediction, with a full softmax probability distribution and a confidence-threshold abstention flag — never per-pixel segmentation.',
    featureSchema: ['remote_sensing.reflectance.blue', 'remote_sensing.reflectance.green', 'remote_sensing.reflectance.red', 'remote_sensing.reflectance.nir', 'remote_sensing.reflectance.swir1', 'remote_sensing.reflectance.swir2'],
    trainingDatasetRef: 'ibm-nasa-geospatial/multi-temporal-crop-classification (CC-BY-4.0)',
    datasetVersion: 'official-split-2023-08-18',
    trainedAt: 1788885518274,
    evaluatedAt: 1788885518274,
    evaluationMetrics: {
      validationAccuracy: 0.9315068493150684,
      validationBalancedAccuracy: 0.9320276497695852,
      validationMacroF1: 0.9301969783897495,
      majorityClassBaselineAccuracy: 0.5753424657534246,
      validationSampleCount: 73,
      trainSampleCount: 368,
      abstentionCoverageFraction: 1.0
    },
    deploymentStatus: 'STAGED',
    limitations:
      'Real, strongly-performing benchmark result (93.15% validation accuracy vs. 57.53% majority baseline), but a benchmark result, not a live-field one: linear head trained on 368 purity-filtered chips, evaluated on 73 official held-out chips (95% Wilson CI on this sample: approximately [85%, 97%] — genuinely strong, but not a precise number). Domain shift is unverified for any field outside this benchmark\'s CONUS/2022 HLS distribution, and specifically unverified for AgriAether\'s live Iowa test field (see world/realTestField.ts) since the live pipeline does not yet fetch the 6-band/3-timestep input this model requires. The dataset\'s official train/validation split is random, not geographically buffered, so some benchmark train/validation chips are geographically adjacent — a property of the official dataset, disclosed in ml/README.md. See ml/manifests/evaluation_report.json for full per-class metrics and confusion matrix.',
    confidenceCalibration: 'Softmax max-probability abstention threshold 0.5 (see ml/src/train.py) — a heuristic operating point, not a calibrated probability of real-world correctness. 0/73 validation predictions abstained.'
  })
];
