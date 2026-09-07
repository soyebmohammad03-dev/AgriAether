import { describe, expect, it } from 'vitest';
import { decideNextMission } from './AutonomyEngine';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';
import type { Recommendation } from '../sensing/RecommendationEngine';
import type { FieldTwinSnapshot } from '../twin/FieldTwin';

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: 'r1',
    category: 'FIELD_OPERATION',
    fieldId: 'f',
    zoneId: null,
    status: 'ACTIONABLE',
    proposedAction: 'x',
    rationale: 'x',
    evidenceObservationIds: ['obs_1'],
    missingEvidence: [],
    confidence: null,
    urgency: 'HIGH',
    timestamp: 1,
    provenance: 'test',
    ...overrides
  };
}

function twinWith(recommendations: Recommendation[]): FieldTwinSnapshot {
  return { fieldId: 'f', recommendations } as unknown as FieldTwinSnapshot;
}

describe('decideNextMission', () => {
  const geoReference = { kind: 'geodetic' as const, crs: 'EPSG:4326' as const, geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' as const };

  it('defaults to a routine FIELD_SURVEY when nothing is actionable', () => {
    const decision = decideNextMission({ twin: twinWith([]), geoReference, availableSensorKinds: ['rgb-camera'] });
    expect(decision.objective).toBe('FIELD_SURVEY');
    expect(decision.triggeringRecommendationId).toBeNull();
  });

  it('prioritizes the highest-urgency actionable recommendation', () => {
    const low = rec({ id: 'low', urgency: 'LOW', category: 'NUTRIENT' });
    const high = rec({ id: 'high', urgency: 'HIGH', category: 'IRRIGATION' });
    const decision = decideNextMission({ twin: twinWith([low, high]), geoReference, availableSensorKinds: ['soil-moisture', 'soil-ec', 'soil-ph'] });
    expect(decision.triggeringRecommendationId).toBe('high');
    expect(decision.objective).toBe('SOIL_SAMPLING');
  });

  it('carries an invalid validation result rather than hiding it when required sensors are unavailable', () => {
    const decision = decideNextMission({ twin: twinWith([rec({})]), geoReference, availableSensorKinds: [] });
    expect(decision.validation.valid).toBe(false);
  });
});
