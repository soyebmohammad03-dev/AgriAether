import { createId } from '../domain/id';
import type { KnowledgeGraph } from '../graph/KnowledgeGraph';
import type { Explanation } from './Explanation';

export interface DecisionTraceStep {
  stage: 'observation' | 'evidence' | 'rule' | 'decision';
  description: string;
  refIds: string[];
}

export interface DecisionTrace {
  id: string;
  subjectId: string;
  subjectGraphNodeId: string;
  steps: DecisionTraceStep[];
  explanation: Explanation;
  /** Observation graph nodes reached via KnowledgeGraph.evidenceFor — the same traversal the Twin panel already uses, not a second provenance system. */
  graphEvidenceNodeIds: string[];
  generatedAt: number;
}

/**
 * Renders an Explanation's `input observations -> evidence -> rule ->
 * decision` chain as an ordered, inspectable trace — reusing
 * KnowledgeGraph.evidenceFor() for the observation-discovery step rather
 * than building a second provenance/graph mechanism. Every refIds entry
 * points at an id that already exists elsewhere (an Observation id, this
 * Explanation's own id); nothing here is synthesized.
 */
export function buildDecisionTrace(params: { explanation: Explanation; graph: KnowledgeGraph; subjectGraphNodeId: string }): DecisionTrace {
  const evidenceNodes = params.graph.evidenceFor(params.subjectGraphNodeId);
  const graphEvidenceNodeIds = evidenceNodes.map((n) => n.id);

  const steps: DecisionTraceStep[] = [
    {
      stage: 'observation',
      description: `${graphEvidenceNodeIds.length} source observation(s) reachable from "${params.subjectGraphNodeId}" via the knowledge graph.`,
      refIds: graphEvidenceNodeIds
    },
    {
      stage: 'evidence',
      description: `${params.explanation.evidenceObservationIds.length} observation(s) actually used; ${params.explanation.evidenceNotAvailable.length} evidence categor(y/ies) missing.`,
      refIds: params.explanation.evidenceObservationIds
    },
    {
      stage: 'rule',
      description: `Produced by "${params.explanation.method}" (provenance: ${params.explanation.provenance}).`,
      refIds: []
    },
    {
      stage: 'decision',
      description: params.explanation.conclusion,
      refIds: [params.explanation.subjectId]
    }
  ];

  return {
    id: createId('decision_trace'),
    subjectId: params.explanation.subjectId,
    subjectGraphNodeId: params.subjectGraphNodeId,
    steps,
    explanation: params.explanation,
    graphEvidenceNodeIds,
    generatedAt: Date.now()
  };
}
