import { describe, expect, it } from 'vitest';
import { explainRecommendation, explainCropStress, explainDiseasePestRisk } from './Explanation';
import { assessCropStress } from '../sensing/CropStressSignal';
import { assessDiseasePestRisk } from '../sensing/DiseasePestSignal';
import type { Recommendation } from '../sensing/RecommendationEngine';

describe('explainRecommendation', () => {
  it('never invents a confidence value — copies it through verbatim', () => {
    const r: Recommendation = {
      id: 'r1',
      category: 'IRRIGATION',
      fieldId: 'f',
      zoneId: null,
      status: 'ACTIONABLE',
      proposedAction: 'Inspect the zone',
      rationale: 'DRY soil',
      evidenceObservationIds: ['obs_1'],
      missingEvidence: [],
      confidence: null,
      urgency: 'HIGH',
      timestamp: 1,
      provenance: 'test'
    };
    const explanation = explainRecommendation(r);
    expect(explanation.confidence).toBeNull();
    expect(explanation.evidenceObservationIds).toEqual(['obs_1']);
    expect(explanation.subjectId).toBe('r1');
  });
});

describe('explainCropStress', () => {
  it('never claims a diagnosis in the farmer-facing text', () => {
    const a = assessCropStress({ fieldId: 'f', soilMoistureStatus: 'DRY' });
    const explanation = explainCropStress(a);
    expect(explanation.farmerText).not.toMatch(/diagnos/i);
  });
});

describe('explainDiseasePestRisk', () => {
  it('states risk-factor-only in assumptions, never a pathogen/species claim', () => {
    const a = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's' });
    const explanation = explainDiseasePestRisk(a);
    expect(explanation.assumptions.join(' ')).toMatch(/no pathogen/i);
    expect(explanation.farmerText).not.toMatch(/fungicide|pesticide/i);
  });
});
