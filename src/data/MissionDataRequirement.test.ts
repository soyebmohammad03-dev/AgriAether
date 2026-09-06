import { describe, expect, it } from 'vitest';
import { evaluateMissionDataRequirements } from './MissionDataRequirement';
import { evaluateAllAnalyses } from '../sensing/AnalysisRegistry';

describe('evaluateMissionDataRequirements', () => {
  it('marks every vegetation-index analysis MISSION_REQUIRED when no multispectral sensor is deployed', () => {
    const evaluations = evaluateAllAnalyses(['gps', 'imu', 'barometer', 'battery']);
    const requirements = evaluateMissionDataRequirements(evaluations, ['gps', 'imu', 'barometer', 'battery']);
    const ndvi = requirements.find((r) => r.analysisId === 'vegetation_index:NDVI')!;
    expect(ndvi.status).toBe('MISSION_REQUIRED');
    expect(ndvi.required).toContain('multispectral-camera');
  });

  it('marks a structurally-available analysis SUFFICIENT', () => {
    const evaluations = evaluateAllAnalyses([]);
    const requirements = evaluateMissionDataRequirements(evaluations, []);
    const temporal = requirements.find((r) => r.analysisId === 'temporal:observation_change')!;
    expect(temporal.status).toBe('SUFFICIENT');
  });
});
