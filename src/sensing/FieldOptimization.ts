import type { Recommendation } from './RecommendationEngine';

export type FieldOptimizationStatus = 'OPTIMAL' | 'ATTENTION' | 'CONSTRAINED' | 'INSUFFICIENT_DATA';

export interface FieldOptimizationResult {
  fieldId: string;
  zoneId: string | null;
  status: FieldOptimizationStatus;
  /** What triggered this status — human-readable, always traceable to a real recommendation/assessment below. */
  triggers: string[];
  evidenceObservationIds: string[];
  missingEvidence: string[];
  recommendations: Recommendation[];
  computedAt: number;
  method: string;
}

/**
 * The final step of the decision pipeline: combines whatever
 * recommendations were already generated (from irrigation, nutrient, crop
 * stress, disease/pest evidence — see RecommendationEngine.ts) into one
 * prioritized field/zone status. Produces no score, no percentage — only a
 * status plus the real triggers/evidence/missing-evidence behind it.
 * CONSTRAINED is reserved for a MEDIUM/HIGH-urgency actionable
 * recommendation; ATTENTION covers any other actionable recommendation;
 * OPTIMAL means evidence exists and nothing fired; INSUFFICIENT_DATA means
 * every recommendation present is itself NEEDS_MORE_DATA (or none exist).
 */
export function evaluateFieldOptimization(params: {
  fieldId: string;
  zoneId?: string | null;
  hasAnyEvidence: boolean;
  recommendations: Recommendation[];
}): FieldOptimizationResult {
  const { recommendations } = params;
  const actionable = recommendations.filter((r) => r.status === 'ACTIONABLE');
  const constraining = actionable.filter((r) => r.urgency === 'HIGH' || r.urgency === 'MEDIUM');
  const missingEvidence = Array.from(new Set(recommendations.flatMap((r) => r.missingEvidence)));
  const evidenceObservationIds = Array.from(new Set(recommendations.flatMap((r) => r.evidenceObservationIds)));

  let status: FieldOptimizationStatus;
  let triggers: string[];

  if (!params.hasAnyEvidence) {
    status = 'INSUFFICIENT_DATA';
    triggers = ['No soil, weather, crop, or irrigation evidence available for this field/zone.'];
  } else if (constraining.length > 0) {
    status = 'CONSTRAINED';
    triggers = constraining.map((r) => r.proposedAction);
  } else if (actionable.length > 0) {
    status = 'ATTENTION';
    triggers = actionable.map((r) => r.proposedAction);
  } else if (recommendations.some((r) => r.status === 'NEEDS_MORE_DATA')) {
    status = 'INSUFFICIENT_DATA';
    triggers = recommendations.filter((r) => r.status === 'NEEDS_MORE_DATA').map((r) => r.proposedAction);
  } else {
    status = 'OPTIMAL';
    triggers = ['Evidence available; no recommendation fired.'];
  }

  return {
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    status,
    triggers,
    evidenceObservationIds,
    missingEvidence,
    recommendations,
    computedAt: Date.now(),
    method: 'recommendation_aggregation_v1'
  };
}
