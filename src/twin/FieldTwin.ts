import type { Field } from '../domain/Field';
import type { Zone } from '../domain/Zone';
import type { SensorRecord } from '../domain/SensorRecord';
import type { Observation } from '../observation/Observation';
import type { SoilSample } from '../soil/SoilSample';
import type { CropObservation } from '../domain/CropObservation';
import type { DailyWeatherRecord } from '../weather/DailyWeatherRecord';
import type { FieldCoverageReport } from '../data/Coverage';
import type { DataGap } from '../data/DataGap';
import type { AgriculturalEvent } from '../domain/AgriculturalEvent';
import { summarizeSoilSampleQuality, type SoilSampleQualitySummary } from '../soil/SoilQuality';
import { summarizeFieldCropStatus, type FieldCropStatusSummary } from '../domain/CropStatusChange';
import { summarizeWeatherWindow, type WeatherWindowSummary } from '../weather/WeatherIntelligence';
import { alignObservationEvidence, type FusedEvidenceBundle } from '../sensing/SensorFusion';
import { trendDirection, type TrendResult } from '../temporal/TemporalIntelligence';
import { assessDiseasePestRisk, type DiseasePestAssessment } from '../sensing/DiseasePestSignal';
import { assessCropStress, type CropStressAssessment } from '../sensing/CropStressSignal';
import { assessIrrigationNeed, type IrrigationAssessment } from '../irrigation/IrrigationIntelligence';
import { summarizeNutrientEvidence, type NutrientEvidenceSummary } from '../soil/NutrientIntelligence';
import { generateRecommendations, type Recommendation } from '../sensing/RecommendationEngine';
import { evaluateFieldOptimization, type FieldOptimizationResult } from '../sensing/FieldOptimization';

/** Observation types tracked for recent-trend reporting — the small set this codebase can currently produce a numeric time series for. Extend as new sensor kinds land; never invent a type that has no producer. */
export const TWIN_TRACKED_TYPES: readonly string[] = [
  'soil.moisture',
  'soil.ec',
  'soil.ph',
  'weather.air_temperature',
  'weather.daily_temp_max',
  'weather.daily_precipitation'
];

/**
 * Unified current + historical view of one field, assembled entirely from
 * data this codebase already computed elsewhere (WorldRegistry entities,
 * soil/crop/weather summaries, sensor-fusion evidence). No health score is
 * ever produced — a section with nothing behind it says so explicitly via
 * `null`/`'INSUFFICIENT_DATA'` rather than a fabricated value.
 */
export interface FieldTwinSnapshot {
  fieldId: string;
  fieldName: string;
  generatedAt: number;
  zones: Array<{ id: string; name: string }>;
  activeSensors: Array<{ id: string; kind: string; name: string }>;
  soilState: SoilSampleQualitySummary | 'INSUFFICIENT_DATA';
  cropState: FieldCropStatusSummary;
  weatherState: WeatherWindowSummary | 'INSUFFICIENT_DATA';
  /** Raw vegetation-index Observations found for this field — never a derived index computed here, just what IndexEngine already produced elsewhere. */
  vegetationEvidence: Observation<unknown>[];
  recentTrends: Record<string, TrendResult | null>;
  evidence: FusedEvidenceBundle;
  coverage: FieldCoverageReport;
  dataGaps: DataGap[];
  diseasePestRisk: DiseasePestAssessment;
  cropStress: CropStressAssessment;
  irrigation: IrrigationAssessment;
  nutrient: NutrientEvidenceSummary;
  recommendations: Recommendation[];
  fieldOptimization: FieldOptimizationResult;
}

export function buildFieldTwin(params: {
  field: Field;
  zones: Zone[];
  activeSensors: SensorRecord[];
  recentObservations: ReadonlyArray<Observation<unknown>>;
  soilSamples: SoilSample[];
  cropObservations: CropObservation[];
  dailyWeatherRecords: DailyWeatherRecord[];
  coverage: FieldCoverageReport;
  dataGaps: DataGap[];
  recentEvents?: AgriculturalEvent[];
  now?: number;
  lookbackMs?: number;
  trackedTypes?: readonly string[];
}): FieldTwinSnapshot {
  const now = params.now ?? Date.now();
  const lookbackMs = params.lookbackMs ?? 7 * 24 * 60 * 60 * 1000;
  const trackedTypes = params.trackedTypes ?? TWIN_TRACKED_TYPES;

  const latestSoilSample =
    params.soilSamples.length > 0 ? params.soilSamples.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)) : null;

  const vegetationEvidence = params.recentObservations.filter(
    (o) => o.fieldId === params.field.id && o.type.startsWith('vegetation_index.')
  );

  const recentTrends: Record<string, TrendResult | null> = {};
  for (const type of trackedTypes) {
    recentTrends[type] = trendDirection(
      params.recentObservations as ReadonlyArray<Observation<number>>,
      params.field.id,
      type,
      now - lookbackMs,
      now
    );
  }

  const evidence = alignObservationEvidence({
    observations: params.recentObservations,
    fieldId: params.field.id,
    windowStartMs: now - lookbackMs,
    windowEndMs: now,
    now,
    expectedTypes: trackedTypes
  });

  const soilState = latestSoilSample ? summarizeSoilSampleQuality(latestSoilSample) : 'INSUFFICIENT_DATA';
  const weatherState = params.dailyWeatherRecords.length > 0 ? summarizeWeatherWindow(params.dailyWeatherRecords) : 'INSUFFICIENT_DATA';
  const latestVegetation = vegetationEvidence.length > 0 ? vegetationEvidence[vegetationEvidence.length - 1] : null;

  const diseasePestRisk = assessDiseasePestRisk({
    fieldId: params.field.id,
    soilMoistureStatus: soilState === 'INSUFFICIENT_DATA' ? null : soilState.moistureStatus,
    soilSampleId: latestSoilSample?.id ?? null,
    precipitationTotalMm: weatherState === 'INSUFFICIENT_DATA' ? null : weatherState.precipitationTotalMm,
    tMaxAvgC: weatherState === 'INSUFFICIENT_DATA' ? null : weatherState.tMaxAvgC,
    weatherObservationId: params.dailyWeatherRecords.length > 0 ? params.dailyWeatherRecords[params.dailyWeatherRecords.length - 1].id : null,
    vegetationIndex: latestVegetation ? { id: latestVegetation.id, type: latestVegetation.type, value: latestVegetation.value as number } : null,
    hasCropObservation: params.cropObservations.length > 0
  });

  const latestDailyWeather = params.dailyWeatherRecords.length > 0 ? params.dailyWeatherRecords[params.dailyWeatherRecords.length - 1] : null;
  const cropStress = assessCropStress({
    fieldId: params.field.id,
    vegetationIndex: latestVegetation ? { id: latestVegetation.id, type: latestVegetation.type, value: latestVegetation.value as number } : null,
    soilMoistureStatus: soilState === 'INSUFFICIENT_DATA' ? null : soilState.moistureStatus,
    soilEcStatus: soilState === 'INSUFFICIENT_DATA' ? null : soilState.ecStatus,
    soilSampleId: latestSoilSample?.id ?? null,
    recentTMaxC: latestDailyWeather?.tMaxC ?? null,
    weatherObservationId: latestDailyWeather?.id ?? null,
    hasCropObservation: params.cropObservations.length > 0
  });

  const irrigation = assessIrrigationNeed({
    fieldId: params.field.id,
    moistureStatus: soilState === 'INSUFFICIENT_DATA' ? null : soilState.moistureStatus,
    moistureSampleId: latestSoilSample?.id ?? null,
    observations: params.recentObservations as ReadonlyArray<Observation<number>>,
    recentRainfallMm: weatherState === 'INSUFFICIENT_DATA' ? null : weatherState.precipitationTotalMm,
    recentEvents: params.recentEvents ?? [],
    now,
    lookbackMs
  });

  const nutrient = summarizeNutrientEvidence({
    fieldId: params.field.id,
    latestSample: latestSoilSample,
    observations: params.recentObservations as ReadonlyArray<Observation<number>>,
    now
  });

  const recommendations = generateRecommendations({ fieldId: params.field.id, irrigation, nutrient, cropStress, diseasePestRisk });

  const hasAnyEvidence = soilState !== 'INSUFFICIENT_DATA' || weatherState !== 'INSUFFICIENT_DATA' || params.cropObservations.length > 0 || vegetationEvidence.length > 0;
  const fieldOptimization = evaluateFieldOptimization({ fieldId: params.field.id, hasAnyEvidence, recommendations });

  return {
    fieldId: params.field.id,
    fieldName: params.field.name,
    generatedAt: now,
    zones: params.zones.map((z) => ({ id: z.id, name: z.name })),
    activeSensors: params.activeSensors.map((s) => ({ id: s.id, kind: s.kind, name: s.name })),
    soilState,
    cropState: summarizeFieldCropStatus(params.field.id, params.cropObservations),
    weatherState,
    vegetationEvidence,
    recentTrends,
    evidence,
    coverage: params.coverage,
    dataGaps: params.dataGaps,
    diseasePestRisk,
    cropStress,
    irrigation,
    nutrient,
    recommendations,
    fieldOptimization
  };
}
