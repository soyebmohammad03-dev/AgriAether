import { createId } from '../domain/id';
import type { GeoReference } from '../domain/GeoReference';
import type { FieldTwinSnapshot } from '../twin/FieldTwin';
import type { Recommendation, RecommendationCategory } from '../sensing/RecommendationEngine';
import { planAgriculturalMission, type AgriculturalMissionPlan, type MissionObjective } from '../mission/AgriculturalMission';
import { validateMissionPlan, type MissionValidationResult } from '../mission/MissionValidation';

const CATEGORY_TO_OBJECTIVE: Record<RecommendationCategory, MissionObjective> = {
  IRRIGATION: 'SOIL_SAMPLING',
  NUTRIENT: 'SOIL_SAMPLING',
  FIELD_OPERATION: 'TARGETED_INSPECTION'
};

const URGENCY_RANK: Record<'HIGH' | 'MEDIUM' | 'LOW', number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export interface MissionDecision {
  id: string;
  fieldId: string;
  zoneId: string | null;
  objective: MissionObjective;
  /** The Recommendation this mission was planned to act on, or null when defaulting to a routine survey. */
  triggeringRecommendationId: string | null;
  rationale: string;
  evidenceObservationIds: string[];
  plan: AgriculturalMissionPlan;
  validation: MissionValidationResult;
  decidedAt: number;
}

/**
 * The autonomy decision layer: turns whatever the Digital Twin's
 * RecommendationEngine output already says (see twin/FieldTwin.ts) into one
 * mission objective, prioritized deterministically by urgency — never a
 * learned policy, never a random or optimized choice. Falls back to a
 * routine FIELD_SURVEY when nothing is actionable, so there is always a
 * defensible next mission rather than an unexplained no-op. Every decision
 * carries the plan AND its validation result — a caller must check
 * `validation.valid` before this decision is ever executed; this function
 * never hides an unsafe/incomplete plan behind a decision that looks ready.
 */
export function decideNextMission(params: {
  twin: FieldTwinSnapshot;
  geoReference: GeoReference;
  availableSensorKinds: readonly string[];
}): MissionDecision {
  const { twin } = params;
  const actionable = twin.recommendations.filter((r): r is Recommendation & { urgency: 'HIGH' | 'MEDIUM' | 'LOW' } => r.status === 'ACTIONABLE' && r.urgency !== null);
  const top = actionable.slice().sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency])[0] ?? null;

  const objective: MissionObjective = top ? CATEGORY_TO_OBJECTIVE[top.category] : 'FIELD_SURVEY';
  const rationale = top ? top.rationale : 'No actionable recommendation is pending — defaulting to a routine field survey.';

  const plan = planAgriculturalMission({
    fieldId: twin.fieldId,
    zoneId: top?.zoneId ?? null,
    objective,
    geoReference: params.geoReference
  });
  const validation = validateMissionPlan(plan, params.availableSensorKinds);

  return {
    id: createId('mission_decision'),
    fieldId: twin.fieldId,
    zoneId: top?.zoneId ?? null,
    objective,
    triggeringRecommendationId: top?.id ?? null,
    rationale,
    evidenceObservationIds: top?.evidenceObservationIds ?? [],
    plan,
    validation,
    decidedAt: Date.now()
  };
}
