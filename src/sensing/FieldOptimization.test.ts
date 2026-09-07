import { describe, expect, it } from 'vitest';
import { evaluateFieldOptimization } from './FieldOptimization';
import type { Recommendation } from './RecommendationEngine';

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: 'r1',
    category: 'IRRIGATION',
    fieldId: 'f',
    zoneId: null,
    status: 'ACTIONABLE',
    proposedAction: 'x',
    rationale: 'x',
    evidenceObservationIds: [],
    missingEvidence: [],
    confidence: null,
    urgency: null,
    timestamp: 1,
    provenance: 'test',
    ...overrides
  };
}

describe('evaluateFieldOptimization', () => {
  it('returns INSUFFICIENT_DATA when there is no evidence at all', () => {
    const result = evaluateFieldOptimization({ fieldId: 'f', hasAnyEvidence: false, recommendations: [] });
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });

  it('returns OPTIMAL when evidence exists and no recommendation fired', () => {
    const result = evaluateFieldOptimization({ fieldId: 'f', hasAnyEvidence: true, recommendations: [] });
    expect(result.status).toBe('OPTIMAL');
  });

  it('returns CONSTRAINED for a HIGH-urgency actionable recommendation', () => {
    const result = evaluateFieldOptimization({ fieldId: 'f', hasAnyEvidence: true, recommendations: [rec({ urgency: 'HIGH' })] });
    expect(result.status).toBe('CONSTRAINED');
  });

  it('returns ATTENTION for a LOW-urgency actionable recommendation', () => {
    const result = evaluateFieldOptimization({ fieldId: 'f', hasAnyEvidence: true, recommendations: [rec({ urgency: 'LOW' })] });
    expect(result.status).toBe('ATTENTION');
  });

  it('never invents a numeric optimization score on the result', () => {
    const result = evaluateFieldOptimization({ fieldId: 'f', hasAnyEvidence: true, recommendations: [] });
    expect(result).not.toHaveProperty('score');
  });
});
