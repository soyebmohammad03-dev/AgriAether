import { describe, expect, it } from 'vitest';
import { buildFarmerOverview } from './FarmerInsights';
import type { FieldTwinSnapshot } from '../twin/FieldTwin';

function minimalTwin(overrides: Partial<FieldTwinSnapshot> = {}): FieldTwinSnapshot {
  return {
    fieldId: 'f',
    fieldName: 'Field 01',
    generatedAt: 1,
    zones: [],
    activeSensors: [],
    soilState: 'INSUFFICIENT_DATA',
    cropState: { observationCount: 0, latestGrowthStage: 'UNKNOWN', recentComparison: null } as unknown as FieldTwinSnapshot['cropState'],
    weatherState: 'INSUFFICIENT_DATA',
    vegetationEvidence: [],
    recentTrends: {},
    evidence: { items: [], conflicts: [], missingTypes: [] } as unknown as FieldTwinSnapshot['evidence'],
    coverage: {} as FieldTwinSnapshot['coverage'],
    dataGaps: [],
    diseasePestRisk: { id: 'd1', fieldId: 'f', zoneId: null, status: 'INSUFFICIENT_DATA', riskFactors: [], missingEvidence: [], computedAt: 1, method: 'x' },
    cropStress: { id: 'c1', fieldId: 'f', zoneId: null, status: 'INSUFFICIENT_DATA', signals: [], missingEvidence: [], computedAt: 1, method: 'x' },
    irrigation: { fieldId: 'f', zoneId: null, moistureStatus: null, moistureSampleId: null, moistureTrend: null, recentRainfallMm: null, recentIrrigationEvents: [], needStatus: 'INSUFFICIENT_DATA', reasons: [], missingEvidence: [], computedAt: 1, method: 'x' },
    nutrient: { fieldId: 'f', zoneId: null, nitrogen: null, phosphorus: null, potassium: null, missing: ['nitrogen', 'phosphorus', 'potassium'], trend: { 'soil.nitrogen': null, 'soil.phosphorus': null, 'soil.potassium': null }, computedAt: 1 },
    recommendations: [],
    fieldOptimization: { fieldId: 'f', zoneId: null, status: 'INSUFFICIENT_DATA', triggers: [], evidenceObservationIds: [], missingEvidence: [], recommendations: [], computedAt: 1, method: 'x' },
    ...overrides
  };
}

describe('buildFarmerOverview', () => {
  it('surfaces missing evidence as a missing-information request, never confident advice, when the twin has nothing', () => {
    const overview = buildFarmerOverview({ twin: minimalTwin(), missionDecision: null });
    expect(overview.missingInformationRequests.length).toBeGreaterThan(0);
    expect(overview.currentConditions.every((i) => !/ndvi|crs/i.test(i.text))).toBe(true);
  });

  it('never exposes a raw numeric score in plain-language text', () => {
    const overview = buildFarmerOverview({ twin: minimalTwin(), missionDecision: null });
    for (const i of [...overview.currentConditions, ...overview.opportunities]) {
      expect(i.text).not.toMatch(/score/i);
    }
  });

  it('reports "no mission planned" honestly when no decision was supplied', () => {
    const overview = buildFarmerOverview({ twin: minimalTwin(), missionDecision: null });
    expect(overview.missionStatusText).toMatch(/no mission/i);
  });
});
