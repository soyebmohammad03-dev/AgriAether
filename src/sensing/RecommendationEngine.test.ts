import { describe, expect, it } from 'vitest';
import { generateRecommendations, recommendFromSectionEvidence } from './RecommendationEngine';
import { assessIrrigationNeed } from '../irrigation/IrrigationIntelligence';
import { summarizeNutrientEvidence } from '../soil/NutrientIntelligence';
import { assessCropStress } from './CropStressSignal';
import { assessDiseasePestRisk } from './DiseasePestSignal';

describe('generateRecommendations', () => {
  it('proposes an ACTIONABLE irrigation recommendation with no water volume when moisture is DRY', () => {
    const irrigation = assessIrrigationNeed({ fieldId: 'f', moistureStatus: 'DRY', observations: [], recentRainfallMm: 0, recentEvents: [] });
    const nutrient = summarizeNutrientEvidence({ fieldId: 'f', latestSample: null, observations: [] });
    const cropStress = assessCropStress({ fieldId: 'f' });
    const diseasePestRisk = assessDiseasePestRisk({ fieldId: 'f' });
    const recs = generateRecommendations({ fieldId: 'f', irrigation, nutrient, cropStress, diseasePestRisk });
    const irrigationRec = recs.find((r) => r.category === 'IRRIGATION')!;
    expect(irrigationRec.status).toBe('ACTIONABLE');
    expect(irrigationRec.proposedAction).not.toMatch(/liters|litres|gallons/i);
  });

  it('never issues a pesticide/dosage instruction for an elevated disease/pest risk, only an inspection', () => {
    const irrigation = assessIrrigationNeed({ fieldId: 'f', moistureStatus: 'ADEQUATE', observations: [], recentRainfallMm: 0, recentEvents: [] });
    const nutrient = summarizeNutrientEvidence({ fieldId: 'f', latestSample: null, observations: [] });
    const cropStress = assessCropStress({ fieldId: 'f' });
    const diseasePestRisk = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's' });
    const recs = generateRecommendations({ fieldId: 'f', irrigation, nutrient, cropStress, diseasePestRisk });
    const fieldOpRec = recs.find((r) => r.category === 'FIELD_OPERATION')!;
    expect(fieldOpRec.proposedAction).toMatch(/inspection/i);
    expect(fieldOpRec.proposedAction).not.toMatch(/pesticide|fungicide|dose|dosage/i);
  });

  it('returns NEEDS_MORE_DATA for nutrients when no soil sample exists', () => {
    const irrigation = assessIrrigationNeed({ fieldId: 'f', moistureStatus: null, observations: [], recentRainfallMm: null, recentEvents: [] });
    const nutrient = summarizeNutrientEvidence({ fieldId: 'f', latestSample: null, observations: [] });
    const cropStress = assessCropStress({ fieldId: 'f' });
    const diseasePestRisk = assessDiseasePestRisk({ fieldId: 'f' });
    const recs = generateRecommendations({ fieldId: 'f', irrigation, nutrient, cropStress, diseasePestRisk });
    const nutrientRec = recs.find((r) => r.category === 'NUTRIENT')!;
    expect(nutrientRec.status).toBe('NEEDS_MORE_DATA');
  });
});

describe('recommendFromSectionEvidence', () => {
  const zoneGeneration = {
    zoneId: 'zone_1',
    fieldId: 'f',
    method: 'kmeans_ndvi_connected_components',
    version: '1.0.0',
    parameters: {},
    featureNames: ['NDVI'],
    normalization: 'min-max',
    minRegionCells: 4,
    sourceObservationIds: ['obs_1'],
    sourceDatasetIds: ['ds_1'],
    cellCount: 20,
    coverageFraction: 0.9,
    areaHectares: 1,
    meanNdvi: 0.5,
    ndviStdDev: 0.1,
    quality: 'VALID' as const,
    generatedAt: 1
  };

  it('recommends ground-truth collection, never a confident action, when the model abstained', () => {
    const prediction = {
      id: 'p1', modelId: 'm1', modelVersion: 'v1', task: 'CROP_TYPE_CLASSIFICATION' as const, fieldId: 'f', zoneId: 'zone_1',
      status: 'NOT_AVAILABLE' as const, value: null, confidence: 0.3, reason: 'low confidence', inputObservationIds: [], requestedAt: 1,
      predictedClassId: null, predictedClassName: null, probabilityDistribution: null, abstained: true, abstentionReason: 'confidence 0.3 below 0.5',
      datasetVersion: null, inputSource: 'MODEL_VALIDATION_DATA' as const
    };
    const recs = recommendFromSectionEvidence({ fieldId: 'f', zoneId: 'zone_1', zoneGeneration, prediction });
    const rec = recs.find((r) => r.proposedAction.includes('ground crop observation'))!;
    expect(rec.status).toBe('NEEDS_MORE_DATA');
  });

  it('never presents a benchmark (non-live-field) prediction as confirmed — always flags it for verification', () => {
    const prediction = {
      id: 'p1', modelId: 'm1', modelVersion: 'v1', task: 'CROP_TYPE_CLASSIFICATION' as const, fieldId: 'f', zoneId: 'zone_1',
      status: 'PREDICTED' as const, value: null, confidence: 0.9, reason: null, inputObservationIds: [], requestedAt: 1,
      predictedClassId: '3', predictedClassName: 'Corn', probabilityDistribution: null, abstained: false, abstentionReason: null,
      datasetVersion: null, inputSource: 'MODEL_VALIDATION_DATA' as const
    };
    const recs = recommendFromSectionEvidence({ fieldId: 'f', zoneId: 'zone_1', zoneGeneration, prediction });
    const rec = recs.find((r) => r.proposedAction.includes('Corn'))!;
    expect(rec.rationale).toMatch(/unverified/i);
    expect(rec.missingEvidence).toContain('live_field_ground_truth');
  });

  it('recommends additional imaging for a low-coverage section', () => {
    const lowCoverage = { ...zoneGeneration, coverageFraction: 0.2 };
    const recs = recommendFromSectionEvidence({ fieldId: 'f', zoneId: 'zone_1', zoneGeneration: lowCoverage });
    expect(recs.some((r) => r.proposedAction.includes('additional satellite pass or drone survey'))).toBe(true);
  });
});
