import { describe, expect, it } from 'vitest';
import { buildDecisionTrace } from './DecisionTrace';
import { explainRecommendation } from './Explanation';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { WorldRegistry } from '../world/WorldRegistry';
import { createInMemoryRepositories } from '../persistence/repositories';
import { createFarm } from '../domain/Farm';
import { createField } from '../domain/Field';
import type { Observation } from '../observation/Observation';
import type { Recommendation } from '../sensing/RecommendationEngine';

describe('buildDecisionTrace', () => {
  it('has four ordered stages ending in the decision, and reuses KnowledgeGraph evidence traversal', async () => {
    const registry = await WorldRegistry.load(createInMemoryRepositories());
    const farm = await registry.registerFarm(createFarm({ name: 'Farm', geoReference: { kind: 'simulation' } }));
    const field = await registry.registerField(createField({ farmId: farm.id, name: 'Field', geoReference: { kind: 'simulation' } }));

    const observation: Observation<number> = {
      id: 'obs_1',
      type: 'soil.moisture',
      value: 5,
      unit: 'percent',
      timestamp: 1000,
      location: null,
      source: 'sim',
      provenance: 'SIMULATED',
      confidence: 0.9,
      status: 'OK',
      fieldId: field.id,
      zoneId: null
    };
    const graph = KnowledgeGraph.build(registry, [observation]);

    const r: Recommendation = {
      id: 'r1',
      category: 'IRRIGATION',
      fieldId: field.id,
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
    const trace = buildDecisionTrace({ explanation, graph, subjectGraphNodeId: `Field:${field.id}` });

    expect(trace.steps.map((s) => s.stage)).toEqual(['observation', 'evidence', 'rule', 'decision']);
    expect(trace.graphEvidenceNodeIds).toContain('Observation:obs_1');
    expect(trace.steps[trace.steps.length - 1].description).toBe(explanation.conclusion);
  });
});
