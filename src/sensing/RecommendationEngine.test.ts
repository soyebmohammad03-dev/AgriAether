import { describe, expect, it } from 'vitest';
import { generateRecommendations } from './RecommendationEngine';
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
