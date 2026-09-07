import { createId } from '../domain/id';
import type { Recommendation } from '../sensing/RecommendationEngine';
import type { CropStressAssessment } from '../sensing/CropStressSignal';
import type { DiseasePestAssessment } from '../sensing/DiseasePestSignal';
import type { IrrigationAssessment } from '../irrigation/IrrigationIntelligence';
import type { NutrientEvidenceSummary } from '../soil/NutrientIntelligence';
import type { FieldOptimizationResult } from '../sensing/FieldOptimization';
import type { MissionDecision } from '../drone/AutonomyEngine';
import type { PredictionRecord, ModelRecord } from '../sensing/ModelRegistry';

export type ExplanationSubjectType =
  | 'recommendation'
  | 'crop_stress'
  | 'disease_pest_risk'
  | 'irrigation'
  | 'nutrient'
  | 'field_optimization'
  | 'prediction'
  | 'mission_decision';

/**
 * One normalized explanation shape over every kind of evidence-based output
 * this codebase already produces. Nothing here computes a new result — each
 * `explainX` function only rephrases fields that already exist on its
 * subject (RecommendationEngine, CropStressSignal, DiseasePestSignal,
 * IrrigationIntelligence, NutrientIntelligence, FieldOptimization,
 * AutonomyEngine, ModelRegistry). `confidence` is copied through verbatim —
 * never invented — and is `null` wherever the subject itself reports null.
 */
export interface Explanation {
  id: string;
  subjectId: string;
  subjectType: ExplanationSubjectType;
  conclusion: string;
  evidenceObservationIds: string[];
  evidenceNotAvailable: string[];
  provenance: string;
  confidence: number | null;
  method: string;
  assumptions: string[];
  limitations: string[];
  farmerText: string;
  technicalText: string;
  generatedAt: number;
}

function build(params: Omit<Explanation, 'id' | 'generatedAt'>): Explanation {
  return { ...params, id: createId('explanation'), generatedAt: Date.now() };
}

const GENERIC_THRESHOLD_ASSUMPTION = 'Uses generic, widely-cited agronomic thresholds — not calibrated to this specific crop, cultivar, or region.';
const CORRELATION_NOT_CAUSATION = 'Reports a correlation/risk factor only — never a diagnosis or causal claim.';

export function explainRecommendation(r: Recommendation): Explanation {
  return build({
    subjectId: r.id,
    subjectType: 'recommendation',
    conclusion: `${r.status}: ${r.proposedAction}`,
    evidenceObservationIds: r.evidenceObservationIds,
    evidenceNotAvailable: r.missingEvidence,
    provenance: r.provenance,
    confidence: r.confidence,
    method: r.provenance,
    assumptions: [GENERIC_THRESHOLD_ASSUMPTION],
    limitations: r.status === 'NEEDS_MORE_DATA' ? ['Insufficient evidence — this is not an actionable recommendation yet.'] : [],
    farmerText: r.proposedAction,
    technicalText: `[${r.category}/${r.status}] ${r.rationale} Evidence: ${r.evidenceObservationIds.join(', ') || 'none'}. Missing: ${r.missingEvidence.join(', ') || 'none'}.`
  });
}

export function explainCropStress(a: CropStressAssessment): Explanation {
  return build({
    subjectId: a.id,
    subjectType: 'crop_stress',
    conclusion: a.status,
    evidenceObservationIds: a.signals.flatMap((s) => s.supportingObservationIds),
    evidenceNotAvailable: a.missingEvidence,
    provenance: a.method,
    confidence: null,
    method: a.method,
    assumptions: [GENERIC_THRESHOLD_ASSUMPTION, CORRELATION_NOT_CAUSATION],
    limitations: a.status === 'INSUFFICIENT_DATA' ? ['No evidence category was supplied.'] : [],
    farmerText: a.status === 'ATTENTION' ? 'Some signs of crop stress were detected — worth checking in person.' : a.status === 'NORMAL' ? 'No signs of crop stress detected.' : 'Not enough data to check for crop stress yet.',
    technicalText: `[${a.method}] status=${a.status}; signals=${a.signals.map((s) => s.type).join(', ') || 'none'}; missing=${a.missingEvidence.join(', ') || 'none'}.`
  });
}

export function explainDiseasePestRisk(a: DiseasePestAssessment): Explanation {
  return build({
    subjectId: a.id,
    subjectType: 'disease_pest_risk',
    conclusion: a.status,
    evidenceObservationIds: a.riskFactors.flatMap((f) => f.supportingObservationIds),
    evidenceNotAvailable: a.missingEvidence,
    provenance: a.method,
    confidence: null,
    method: a.method,
    assumptions: [GENERIC_THRESHOLD_ASSUMPTION, CORRELATION_NOT_CAUSATION, 'No pathogen, pest species, or severity is ever identified — risk factors only.'],
    limitations: a.status === 'INSUFFICIENT_DATA' ? ['No evidence category was supplied.'] : [],
    farmerText: a.status === 'ELEVATED_RISK' ? 'Conditions match a known risk factor (e.g. wet soil, favorable disease weather) — not a diagnosis, but worth a check.' : a.status === 'NORMAL' ? 'No known disease/pest risk factors detected.' : 'Not enough data to screen for disease/pest risk yet.',
    technicalText: `[${a.method}] status=${a.status}; risk_factors=${a.riskFactors.map((f) => f.type).join(', ') || 'none'}; missing=${a.missingEvidence.join(', ') || 'none'}.`
  });
}

export function explainIrrigation(a: IrrigationAssessment): Explanation {
  return build({
    subjectId: `${a.fieldId}:${a.zoneId ?? 'field'}:irrigation:${a.computedAt}`,
    subjectType: 'irrigation',
    conclusion: a.needStatus,
    evidenceObservationIds: a.moistureSampleId ? [a.moistureSampleId] : [],
    evidenceNotAvailable: a.missingEvidence,
    provenance: a.method,
    confidence: null,
    method: a.method,
    assumptions: ['Never computes a water volume or litres/hectare figure — no calibrated evapotranspiration model exists.'],
    limitations: a.needStatus === 'INSUFFICIENT_DATA' ? ['No soil moisture evidence available.'] : [],
    farmerText: a.reasons[0] ?? 'Not enough data to assess irrigation need yet.',
    technicalText: `[${a.method}] needStatus=${a.needStatus}; moistureStatus=${a.moistureStatus ?? 'null'}; recentRainfallMm=${a.recentRainfallMm ?? 'null'}; reasons=${a.reasons.join(' ') || 'none'}.`
  });
}

export function explainNutrient(n: NutrientEvidenceSummary): Explanation {
  const present = (['nitrogen', 'phosphorus', 'potassium'] as const).filter((k) => n[k] !== null);
  return build({
    subjectId: `${n.fieldId}:${n.zoneId ?? 'field'}:nutrient:${n.computedAt}`,
    subjectType: 'nutrient',
    conclusion: present.length > 0 ? present.map((k) => `${k}=${n[k]!.status}`).join(', ') : 'INSUFFICIENT_DATA',
    evidenceObservationIds: present.map((k) => n[k]!.sampleId),
    evidenceNotAvailable: n.missing,
    provenance: 'rule_based_measurement_bands_v1',
    confidence: null,
    method: 'rule_based_measurement_bands_v1',
    assumptions: [GENERIC_THRESHOLD_ASSUMPTION, 'Never produces a fertilizer rate or a generic fertility score — bands only.'],
    limitations: n.missing.length === 3 ? ['No N/P/K measurement available.'] : [],
    farmerText: present.length > 0 ? `Soil nutrient status: ${present.map((k) => `${k} ${n[k]!.status.toLowerCase()}`).join(', ')}.` : 'No nutrient data available yet.',
    technicalText: `nitrogen=${n.nitrogen ? `${n.nitrogen.value}ppm(${n.nitrogen.status})` : 'null'}; phosphorus=${n.phosphorus ? `${n.phosphorus.value}ppm(${n.phosphorus.status})` : 'null'}; potassium=${n.potassium ? `${n.potassium.value}ppm(${n.potassium.status})` : 'null'}; missing=${n.missing.join(', ') || 'none'}.`
  });
}

export function explainFieldOptimization(f: FieldOptimizationResult): Explanation {
  return build({
    subjectId: `${f.fieldId}:${f.zoneId ?? 'field'}:optimization:${f.computedAt}`,
    subjectType: 'field_optimization',
    conclusion: f.status,
    evidenceObservationIds: f.evidenceObservationIds,
    evidenceNotAvailable: f.missingEvidence,
    provenance: f.method,
    confidence: null,
    method: f.method,
    assumptions: ['Aggregates already-computed recommendations — never a new score or number.'],
    limitations: f.status === 'INSUFFICIENT_DATA' ? ['No underlying evidence or only NEEDS_MORE_DATA recommendations exist.'] : [],
    farmerText: f.triggers[0] ?? 'No issues detected.',
    technicalText: `[${f.method}] status=${f.status}; triggers=${f.triggers.join(' | ') || 'none'}; recommendations=${f.recommendations.length}.`
  });
}

export function explainMissionDecision(d: MissionDecision): Explanation {
  return build({
    subjectId: d.id,
    subjectType: 'mission_decision',
    conclusion: `${d.objective}${d.plan.mission ? '' : ' (no executable mission)'}`,
    evidenceObservationIds: d.evidenceObservationIds,
    evidenceNotAvailable: d.plan.limitations,
    provenance: d.plan.provenance,
    confidence: null,
    method: 'autonomy_priority_selection_v1',
    assumptions: ['Deterministic priority selection by recommendation urgency — never a learned policy.'],
    limitations: d.validation.valid ? [] : d.validation.errors,
    farmerText: d.rationale,
    technicalText: `objective=${d.objective}; triggeringRecommendationId=${d.triggeringRecommendationId ?? 'none'}; validation.valid=${d.validation.valid}; planProvenance=${d.plan.provenance}.`
  });
}

/** For a prediction request that returned NOT_AVAILABLE (every one today — see ModelRegistry.ts) — never fabricates a value or confidence for the missing PREDICTED case. */
export function explainPrediction(p: PredictionRecord, model: ModelRecord): Explanation {
  return build({
    subjectId: p.id,
    subjectType: 'prediction',
    conclusion: p.status,
    evidenceObservationIds: p.inputObservationIds,
    evidenceNotAvailable: p.status === 'NOT_AVAILABLE' ? [p.reason ?? 'unknown reason'] : [],
    provenance: `model:${model.id}@${model.version}`,
    confidence: p.confidence,
    method: `${model.task}/${model.deploymentStatus}`,
    assumptions: [`Model deployment status: ${model.deploymentStatus}.`],
    limitations: [model.limitations],
    farmerText: p.status === 'PREDICTED' ? `Predicted value: ${p.value}` : `No prediction available: ${p.reason ?? 'model not ready'}.`,
    technicalText: `model=${model.id}@${model.version}; task=${model.task}; status=${p.status}; value=${p.value ?? 'null'}; confidence=${p.confidence ?? 'null'}; reason=${p.reason ?? 'none'}.`
  });
}
