import { describe, expect, it } from 'vitest';
import { buildFieldSummary } from './FieldSummary';
import { computeFieldCoverage } from './Coverage';
import { evaluateAllAnalyses } from '../sensing/AnalysisRegistry';

describe('buildFieldSummary', () => {
  it('says "No agricultural analysis available yet" when nothing is supported', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: [], observations: [], weatherAvailable: false });
    const summary = buildFieldSummary({
      fieldId: 'f1',
      fieldName: 'Field 01',
      areaHectares: 1.2,
      datasetCount: 0,
      sensorObservationCount: 0,
      latestAcquisition: null,
      coverage,
      gaps: [],
      analysisEvaluations: [] // no analyses registered/evaluated at all
    });
    expect(summary.note).toBe('No agricultural analysis available yet.');
    expect(summary.availableAnalyses).toEqual([]);
  });

  it('lists the analyses that are actually SUPPORTED, no more', () => {
    const coverage = computeFieldCoverage({ fieldId: 'f1', availableSensorKinds: ['gps'], observations: [], weatherAvailable: true });
    const evaluations = evaluateAllAnalyses(['gps']);
    const summary = buildFieldSummary({
      fieldId: 'f1',
      fieldName: 'Field 01',
      areaHectares: null,
      datasetCount: 1,
      sensorObservationCount: 10,
      latestAcquisition: Date.now(),
      coverage,
      gaps: [],
      analysisEvaluations: evaluations
    });
    expect(summary.availableAnalyses).toContain('Temporal Observation Change');
    expect(summary.availableAnalyses).not.toContain('Normalized Difference Vegetation Index');
    expect(summary.note).toBeNull();
  });
});
