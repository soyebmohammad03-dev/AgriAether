import { describe, expect, it } from 'vitest';
import { assessDiseasePestRisk } from './DiseasePestSignal';

describe('assessDiseasePestRisk', () => {
  it('returns INSUFFICIENT_DATA when no evidence at all is supplied', () => {
    const result = assessDiseasePestRisk({ fieldId: 'f' });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.riskFactors).toHaveLength(0);
    expect(result.missingEvidence.length).toBeGreaterThan(0);
  });

  it('returns NORMAL when evidence exists and nothing crosses a threshold', () => {
    const result = assessDiseasePestRisk({
      fieldId: 'f',
      soilMoistureStatus: 'ADEQUATE',
      precipitationTotalMm: 5,
      tMaxAvgC: 22,
      hasCropObservation: true
    });
    expect(result.status).toBe('NORMAL');
    expect(result.riskFactors).toHaveLength(0);
  });

  it('returns ELEVATED_RISK and names the factor when a known correlate fires', () => {
    const result = assessDiseasePestRisk({
      fieldId: 'f',
      soilMoistureStatus: 'SATURATED',
      soilSampleId: 'soil_1',
      precipitationTotalMm: 40,
      tMaxAvgC: 20,
      weatherObservationId: 'weather_1'
    });
    expect(result.status).toBe('ELEVATED_RISK');
    const types = result.riskFactors.map((f) => f.type);
    expect(types).toContain('saturated_soil_root_rot_risk');
    expect(types).toContain('favorable_fungal_conditions');
  });

  it('never names a pathogen, species, or diagnosis — risk factors only', () => {
    const result = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's' });
    expect(result.riskFactors[0].description).not.toMatch(/fungus name|pathogen species|diagnos(is|ed)/i);
    expect(result.riskFactors[0].confidence).toBeNull();
  });

  it('cropContext is null when no CropProfile is supplied — identical to pre-crop-aware behavior', () => {
    const result = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's' });
    expect(result.cropContext).toBeNull();
  });

  it('annotates cropContext without changing status/riskFactors when a CropProfile is supplied', async () => {
    const { CROP_PROFILES } = await import('../agriculture/CropProfile');
    const withoutProfile = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's' });
    const withProfile = assessDiseasePestRisk({ fieldId: 'f', soilMoistureStatus: 'SATURATED', soilSampleId: 's', cropProfile: CROP_PROFILES.corn });
    expect(withProfile.status).toBe(withoutProfile.status);
    expect(withProfile.riskFactors).toEqual(withoutProfile.riskFactors);
    expect(withProfile.cropContext).toEqual({ cropName: 'Corn (Zea mays)', hasValidatedThresholds: false, relevantRiskFactorsTriggered: ['saturated_soil_root_rot_risk'] });
  });
});
