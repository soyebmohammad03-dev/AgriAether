import { describe, expect, it } from 'vitest';
import { tasksFromRecommendations, transitionTask } from './Task';
import type { Recommendation } from '../sensing/RecommendationEngine';

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
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
    provenance: 'test',
    ...overrides
  };
}

describe('tasksFromRecommendations', () => {
  it('creates a task traceable back to its recommendation, never a pesticide/fertilizer quantity', () => {
    const tasks = tasksFromRecommendations([rec({})]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('REVIEW_IRRIGATION');
    expect(tasks[0].provenance).toBe('recommendation:r1');
    expect(tasks[0].status).toBe('OPEN');
  });

  it('turns a NEEDS_MORE_DATA recommendation into a data-collection task, not a confident action', () => {
    const tasks = tasksFromRecommendations([rec({ status: 'NEEDS_MORE_DATA', category: 'NUTRIENT' })]);
    expect(tasks[0].type).toBe('COLLECT_SOIL_SAMPLE');
  });
});

describe('transitionTask', () => {
  it('supports OPEN -> IN_PROGRESS -> COMPLETED', () => {
    let task = tasksFromRecommendations([rec({})])[0];
    task = transitionTask(task, 'IN_PROGRESS');
    task = transitionTask(task, 'COMPLETED');
    expect(task.status).toBe('COMPLETED');
  });

  it('rejects an invalid transition', () => {
    const task = tasksFromRecommendations([rec({})])[0];
    expect(() => transitionTask(task, 'COMPLETED')).toThrow(/Invalid task status transition/);
  });
});
