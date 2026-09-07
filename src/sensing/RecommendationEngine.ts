import { createId } from '../domain/id';
import type { IrrigationAssessment } from '../irrigation/IrrigationIntelligence';
import type { NutrientEvidenceSummary } from '../soil/NutrientIntelligence';
import type { CropStressAssessment } from './CropStressSignal';
import type { DiseasePestAssessment } from './DiseasePestSignal';

export type RecommendationCategory = 'IRRIGATION' | 'NUTRIENT' | 'FIELD_OPERATION';
export type RecommendationUrgency = 'LOW' | 'MEDIUM' | 'HIGH';
/** ACTIONABLE means real evidence supports the proposed action; NEEDS_MORE_DATA means the action itself is provisional on collecting the listed missing evidence. */
export type RecommendationStatus = 'ACTIONABLE' | 'NEEDS_MORE_DATA';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  fieldId: string;
  zoneId: string | null;
  status: RecommendationStatus;
  proposedAction: string;
  rationale: string;
  evidenceObservationIds: string[];
  missingEvidence: string[];
  confidence: number | null;
  urgency: RecommendationUrgency | null;
  timestamp: number;
  provenance: string;
}

function makeRecommendation(params: Omit<Recommendation, 'id' | 'timestamp' | 'provenance'>): Recommendation {
  return { ...params, id: createId('recommendation'), timestamp: Date.now(), provenance: 'rule_based_evidence_aggregation_v1' };
}

/**
 * Composes recommendations from assessments this codebase already computed
 * (irrigation need, nutrient evidence, crop stress, disease/pest risk
 * factors) — never a new source of truth. Every recommendation is
 * conditional on the evidence that produced it: incomplete evidence yields
 * NEEDS_MORE_DATA, never a confident action. No pesticide product, dose, or
 * application instruction is ever produced — a disease/pest risk factor
 * only ever proposes a field inspection.
 */
export function generateRecommendations(params: {
  fieldId: string;
  zoneId?: string | null;
  irrigation: IrrigationAssessment;
  nutrient: NutrientEvidenceSummary;
  cropStress: CropStressAssessment;
  diseasePestRisk: DiseasePestAssessment;
}): Recommendation[] {
  const { fieldId, irrigation, nutrient, cropStress, diseasePestRisk } = params;
  const zoneId = params.zoneId ?? null;
  const recommendations: Recommendation[] = [];

  if (irrigation.needStatus === 'LIKELY_NEEDED') {
    const heatCompounding = cropStress.signals.some((s) => s.type === 'heat_stress_conditions');
    recommendations.push(
      makeRecommendation({
        category: 'IRRIGATION',
        fieldId,
        zoneId,
        status: 'ACTIONABLE',
        proposedAction: 'Inspect the zone and consider irrigation. No specific volume is proposed — see NUTRIENT/IRRIGATION model readiness for why.',
        rationale: irrigation.reasons.join(' '),
        evidenceObservationIds: irrigation.moistureSampleId ? [irrigation.moistureSampleId] : [],
        missingEvidence: irrigation.missingEvidence,
        confidence: null,
        urgency: heatCompounding ? 'HIGH' : 'MEDIUM',
      })
    );
  } else if (irrigation.needStatus === 'INSUFFICIENT_DATA') {
    recommendations.push(
      makeRecommendation({
        category: 'IRRIGATION',
        fieldId,
        zoneId,
        status: 'NEEDS_MORE_DATA',
        proposedAction: 'Collect a soil moisture sample before an irrigation decision can be made.',
        rationale: 'No soil moisture evidence is available for this field/zone.',
        evidenceObservationIds: [],
        missingEvidence: irrigation.missingEvidence,
        confidence: null,
        urgency: null,
      })
    );
  }

  const lowNutrients = (['nitrogen', 'phosphorus', 'potassium'] as const).filter((k) => nutrient[k]?.status === 'LOW');
  if (lowNutrients.length > 0) {
    recommendations.push(
      makeRecommendation({
        category: 'NUTRIENT',
        fieldId,
        zoneId,
        status: 'ACTIONABLE',
        proposedAction: `Schedule a lab-verified soil test to confirm ${lowNutrients.join('/')} sufficiency before any fertilizer decision. No rate or product is proposed here.`,
        rationale: `Latest soil sample classifies ${lowNutrients.join(', ')} as LOW.`,
        evidenceObservationIds: lowNutrients.map((k) => nutrient[k]!.sampleId),
        missingEvidence: nutrient.missing,
        confidence: null,
        urgency: 'LOW',
      })
    );
  } else if (nutrient.missing.length === 3) {
    recommendations.push(
      makeRecommendation({
        category: 'NUTRIENT',
        fieldId,
        zoneId,
        status: 'NEEDS_MORE_DATA',
        proposedAction: 'Collect a soil sample with N/P/K measurements — none exist for this field/zone.',
        rationale: 'No nitrogen, phosphorus, or potassium reading is available.',
        evidenceObservationIds: [],
        missingEvidence: nutrient.missing,
        confidence: null,
        urgency: null,
      })
    );
  }

  if (diseasePestRisk.status === 'ELEVATED_RISK') {
    recommendations.push(
      makeRecommendation({
        category: 'FIELD_OPERATION',
        fieldId,
        zoneId,
        status: 'ACTIONABLE',
        proposedAction: 'Schedule an in-field inspection by a qualified agronomist before deciding on any treatment.',
        rationale: diseasePestRisk.riskFactors.map((f) => f.description).join(' '),
        evidenceObservationIds: diseasePestRisk.riskFactors.flatMap((f) => f.supportingObservationIds),
        missingEvidence: diseasePestRisk.missingEvidence,
        confidence: null,
        urgency: 'MEDIUM',
      })
    );
  }

  if (cropStress.status === 'ATTENTION' && recommendations.every((r) => r.category !== 'FIELD_OPERATION')) {
    recommendations.push(
      makeRecommendation({
        category: 'FIELD_OPERATION',
        fieldId,
        zoneId,
        status: 'ACTIONABLE',
        proposedAction: 'Schedule a field inspection — one or more stress correlates fired with no disease/pest risk factor to explain them.',
        rationale: cropStress.signals.map((s) => s.description).join(' '),
        evidenceObservationIds: cropStress.signals.flatMap((s) => s.supportingObservationIds),
        missingEvidence: cropStress.missingEvidence,
        confidence: null,
        urgency: 'LOW',
      })
    );
  }

  return recommendations;
}
