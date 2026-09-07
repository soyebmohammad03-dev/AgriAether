import { describe, expect, it } from 'vitest';
import { runIrrigationWhatIf, compareMissionPlans } from './Experiment';
import { planAgriculturalMission } from '../mission/AgriculturalMission';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';

describe('runIrrigationWhatIf', () => {
  it('tags the baseline as OBSERVED_REAL_DATA and the scenario as HYPOTHETICAL_RESULT', () => {
    const experiment = runIrrigationWhatIf({
      baseline: { fieldId: 'f', moistureStatus: 'ADEQUATE', observations: [], recentRainfallMm: 0, recentEvents: [] },
      scenarioOverrides: { moistureStatus: 'DRY' }
    });
    expect(experiment.baselineKind).toBe('OBSERVED_REAL_DATA');
    const scenarioResult = experiment.results.find((r) => r.label === 'scenario.needStatus')!;
    expect(scenarioResult.kind).toBe('HYPOTHETICAL_RESULT');
    expect(scenarioResult.value).toBe('LIKELY_NEEDED');
  });

  it('never mutates the baseline — reruns the exact same production function', () => {
    const baseline = { fieldId: 'f', moistureStatus: 'ADEQUATE' as const, observations: [], recentRainfallMm: 0, recentEvents: [] };
    runIrrigationWhatIf({ baseline, scenarioOverrides: { moistureStatus: 'DRY' } });
    expect(baseline.moistureStatus).toBe('ADEQUATE');
  });
});

describe('compareMissionPlans', () => {
  it('separates two real deterministic plans into DERIVED_OUTPUT vs HYPOTHETICAL_RESULT', () => {
    const geoReference = { kind: 'geodetic' as const, crs: 'EPSG:4326' as const, geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' as const };
    const planA = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference });
    const planB = planAgriculturalMission({ fieldId: 'f', objective: 'VEGETATION_SURVEY', geoReference, altitudeM: 50 });
    const experiment = compareMissionPlans({ fieldId: 'f', planA, planB });
    expect(experiment.results.some((r) => r.label === 'planB.waypointCount' && r.kind === 'HYPOTHETICAL_RESULT')).toBe(true);
  });
});
