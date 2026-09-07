import type { FieldTwinSnapshot } from '../twin/FieldTwin';
import type { MissionDecision } from '../drone/AutonomyEngine';

export type InsightCategory = 'CONDITION' | 'CHANGE' | 'OPPORTUNITY' | 'DATA_QUALITY' | 'MISSING_INFO';

export interface FarmerInsight {
  id: string;
  category: InsightCategory;
  /** Plain-language text — never an NDVI value, sensor id, or CRS reference. Technical detail stays behind evidenceObservationIds. */
  text: string;
  evidenceObservationIds: string[];
  provenance: string;
  timestamp: number;
}

export interface FarmerOverview {
  fieldId: string;
  fieldName: string;
  generatedAt: number;
  currentConditions: FarmerInsight[];
  importantChanges: FarmerInsight[];
  opportunities: FarmerInsight[];
  dataQualityWarnings: FarmerInsight[];
  missingInformationRequests: FarmerInsight[];
  missionStatusText: string;
}

let counter = 0;
function insight(category: InsightCategory, text: string, evidenceObservationIds: string[], provenance: string): FarmerInsight {
  counter += 1;
  return { id: `insight_${counter}`, category, text, evidenceObservationIds, provenance, timestamp: Date.now() };
}

/**
 * Translates the Digital Twin's already-computed evidence (soil/crop/
 * weather state, disease/pest risk factors, recommendations, data gaps —
 * see twin/FieldTwin.ts) into plain-language farmer-facing insights. This
 * function never computes a new number or claim: it only rephrases what
 * FieldTwinSnapshot already established, and always carries the source
 * observation ids forward. Insufficient evidence is surfaced as a missing-
 * information request, never smoothed into confident advice.
 */
export function buildFarmerOverview(params: { twin: FieldTwinSnapshot; missionDecision: MissionDecision | null }): FarmerOverview {
  const { twin } = params;
  const currentConditions: FarmerInsight[] = [];
  const dataQualityWarnings: FarmerInsight[] = [];
  const missingInformationRequests: FarmerInsight[] = [];

  if (twin.soilState === 'INSUFFICIENT_DATA') {
    missingInformationRequests.push(insight('MISSING_INFO', 'No soil sample has been recorded for this field yet. Add one to see moisture and nutrient status.', [], 'twin.soilState'));
  } else {
    if (twin.soilState.moistureStatus) {
      currentConditions.push(insight('CONDITION', `Soil moisture is currently ${twin.soilState.moistureStatus.toLowerCase()}.`, [], 'twin.soilState'));
    }
  }

  if (twin.weatherState === 'INSUFFICIENT_DATA') {
    missingInformationRequests.push(insight('MISSING_INFO', 'No recent weather history is available for this field.', [], 'twin.weatherState'));
  } else {
    currentConditions.push(
      insight('CONDITION', `Recent rainfall: ${twin.weatherState.precipitationTotalMm !== null ? `${twin.weatherState.precipitationTotalMm.toFixed(0)}mm` : 'unknown'} over the last ${twin.weatherState.windowDays} days.`, [], 'twin.weatherState')
    );
  }

  if (twin.cropState.observationCount === 0) {
    missingInformationRequests.push(insight('MISSING_INFO', 'No crop observations have been logged for this field yet.', [], 'twin.cropState'));
  } else {
    currentConditions.push(insight('CONDITION', `Crop growth stage: ${twin.cropState.latestGrowthStage}.`, [], 'twin.cropState'));
    if (twin.cropState.recentComparison) {
      currentConditions.push(insight('CHANGE', `Crop progression since the last check: ${twin.cropState.recentComparison.progression.toLowerCase()}.`, [], 'twin.cropState.recentComparison'));
    }
  }

  if (twin.diseasePestRisk.status === 'ELEVATED_RISK') {
    currentConditions.push(
      insight(
        'CONDITION',
        `One or more known risk conditions were detected (e.g. wet soil, favorable disease weather) — this is not a diagnosis, but worth an in-person check.`,
        twin.diseasePestRisk.riskFactors.flatMap((f) => f.supportingObservationIds),
        'twin.diseasePestRisk'
      )
    );
  } else if (twin.diseasePestRisk.status === 'INSUFFICIENT_DATA') {
    missingInformationRequests.push(insight('MISSING_INFO', 'Not enough data to screen for disease/pest risk factors yet.', [], 'twin.diseasePestRisk'));
  }

  const importantChanges: FarmerInsight[] = Object.entries(twin.recentTrends)
    .filter(([, trend]) => trend && trend.direction !== 'STABLE' && trend.direction !== 'INSUFFICIENT_DATA')
    .map(([type, trend]) => insight('CHANGE', `${humanizeObservationType(type)} has been ${trend!.direction.toLowerCase()} recently.`, [trend!.observationIdA, trend!.observationIdB], `twin.recentTrends.${type}`));

  const opportunities: FarmerInsight[] = twin.recommendations
    .filter((r) => r.status === 'ACTIONABLE')
    .map((r) => insight('OPPORTUNITY', r.proposedAction, r.evidenceObservationIds, `recommendation:${r.id}`));

  for (const r of twin.recommendations.filter((r) => r.status === 'NEEDS_MORE_DATA')) {
    missingInformationRequests.push(insight('MISSING_INFO', r.proposedAction, [], `recommendation:${r.id}`));
  }

  for (const gap of twin.dataGaps) {
    dataQualityWarnings.push(insight('DATA_QUALITY', gap.description, [], `dataGap:${gap.type}`));
  }

  const missionStatusText = params.missionDecision
    ? params.missionDecision.plan.mission
      ? `A ${params.missionDecision.objective.toLowerCase().replace('_', ' ')} mission has been planned (${params.missionDecision.validation.valid ? 'ready to fly' : 'not ready — see safety validation'}).`
      : `No drone mission could be planned right now: ${params.missionDecision.plan.limitations[0] ?? 'insufficient field geometry.'}`
    : 'No mission has been planned yet.';

  return {
    fieldId: twin.fieldId,
    fieldName: twin.fieldName,
    generatedAt: Date.now(),
    currentConditions,
    importantChanges,
    opportunities,
    dataQualityWarnings,
    missingInformationRequests,
    missionStatusText
  };
}

const TYPE_LABELS: Record<string, string> = {
  'soil.moisture': 'Soil moisture',
  'soil.ec': 'Soil salinity (EC)',
  'soil.ph': 'Soil pH',
  'weather.air_temperature': 'Air temperature',
  'weather.daily_temp_max': 'Daily high temperature',
  'weather.daily_precipitation': 'Rainfall'
};

function humanizeObservationType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
