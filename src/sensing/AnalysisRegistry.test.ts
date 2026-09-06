import { describe, expect, it } from 'vitest';
import { ANALYSIS_REGISTRY, evaluateAllAnalyses, evaluateAnalysis } from './AnalysisRegistry';

describe('AnalysisRegistry', () => {
  it('marks NDVI unsupported when only drone telemetry sensors are deployed', () => {
    const ndvi = ANALYSIS_REGISTRY.find((a) => a.id === 'vegetation_index:NDVI')!;
    const evaluation = evaluateAnalysis(ndvi, ['gps', 'imu', 'barometer', 'battery']);
    expect(evaluation.availability).toBe('UNSUPPORTED');
    expect(evaluation.reason).toMatch(/multispectral-camera/);
  });

  it('marks NDVI supported once a multispectral-camera sensor is deployed', () => {
    const ndvi = ANALYSIS_REGISTRY.find((a) => a.id === 'vegetation_index:NDVI')!;
    const evaluation = evaluateAnalysis(ndvi, ['gps', 'multispectral-camera']);
    expect(evaluation.availability).toBe('SUPPORTED');
  });

  it('change-detection and aggregation analyses require no specific sensor kind', () => {
    const evaluations = evaluateAllAnalyses([]);
    const temporal = evaluations.find((e) => e.definition.id === 'temporal:observation_change')!;
    const aggregation = evaluations.find((e) => e.definition.id === 'aggregation:zone_statistic')!;
    expect(temporal.availability).toBe('SUPPORTED');
    expect(aggregation.availability).toBe('SUPPORTED');
  });

  it('every registered vegetation index analysis requires multispectral-camera, never rgb-camera alone', () => {
    const vegetationAnalyses = ANALYSIS_REGISTRY.filter((a) => a.category === 'VEGETATION_INDEX');
    expect(vegetationAnalyses.length).toBeGreaterThan(0);
    for (const analysis of vegetationAnalyses) {
      expect(analysis.requiredSensorKinds).toContain('multispectral-camera');
      expect(analysis.requiredSensorKinds).not.toContain('rgb-camera');
    }
  });
});
