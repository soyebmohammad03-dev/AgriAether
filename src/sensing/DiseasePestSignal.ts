import { createId } from '../domain/id';
import type { MoistureStatus } from '../soil/SoilQuality';

/**
 * `ELEVATED_RISK` means one or more known agronomic risk *factors* were
 * observed — never that a disease or pest was identified. There is no
 * labeled disease/pest dataset in this codebase (see ModelRegistry), so no
 * pathogen, species, or probability is ever produced here. `INSUFFICIENT_DATA`
 * covers both "no evidence supplied" and "evidence supplied but inconclusive".
 */
export type DiseasePestRiskStatus = 'ELEVATED_RISK' | 'NORMAL' | 'INSUFFICIENT_DATA';

export interface DiseasePestRiskFactor {
  /** e.g. "favorable_fungal_conditions", "saturated_soil_root_rot_risk" — a known agronomic correlate, never a diagnosis. */
  type: string;
  description: string;
  supportingObservationIds: string[];
  confidence: number | null;
}

export interface DiseasePestAssessment {
  id: string;
  fieldId: string;
  zoneId: string | null;
  status: DiseasePestRiskStatus;
  riskFactors: DiseasePestRiskFactor[];
  /** Evidence categories not supplied to this assessment — the honest complement to `riskFactors`. */
  missingEvidence: string[];
  computedAt: number;
  method: string;
}

export interface DiseasePestEvidence {
  fieldId: string;
  zoneId?: string | null;
  vegetationIndex?: { id: string; type: string; value: number } | null;
  soilMoistureStatus?: MoistureStatus | null;
  soilSampleId?: string | null;
  /** Total precipitation (mm) over the recent weather window — a real fungal-favorability correlate, not a forecast. */
  precipitationTotalMm?: number | null;
  /** Average daily max temperature (°C) over the same window. */
  tMaxAvgC?: number | null;
  weatherObservationId?: string | null;
  hasCropObservation?: boolean;
}

/** Widely-cited rough range where many foliar fungal pathogens are favored by sustained moisture — not crop- or pathogen-specific. */
const FUNGAL_FAVORABLE_TEMP_RANGE_C: [number, number] = [15, 30];
/** Generic "sustained wet period" precipitation threshold over the evidence window (mm) — not calibrated to any specific pathogen. */
const FUNGAL_FAVORABLE_PRECIP_MM = 25;
const LOW_VEGETATION_INDEX_THRESHOLD = 0.3;

/**
 * A conservative, evidence-oriented disease/pest *risk-factor* screen —
 * combines whatever real evidence is supplied (weather, soil, vegetation
 * index, crop observation presence) into known agronomic correlates.
 * Explicitly NOT a diagnosis: no pathogen/pest identification, no species,
 * no probability, no severity score. `status` is INSUFFICIENT_DATA whenever
 * no evidence category was supplied, ELEVATED_RISK when at least one known
 * risk factor fired, NORMAL when evidence exists and none fired.
 */
export function assessDiseasePestRisk(evidence: DiseasePestEvidence): DiseasePestAssessment {
  const riskFactors: DiseasePestRiskFactor[] = [];
  const missingEvidence: string[] = [];
  let evidenceCategoriesSupplied = 0;

  if (evidence.soilMoistureStatus !== undefined && evidence.soilMoistureStatus !== null) {
    evidenceCategoriesSupplied += 1;
    if (evidence.soilMoistureStatus === 'SATURATED') {
      riskFactors.push({
        type: 'saturated_soil_root_rot_risk',
        description: 'Most recent soil sample classifies as SATURATED — a known favorable condition for root-rot pathogens.',
        supportingObservationIds: evidence.soilSampleId ? [evidence.soilSampleId] : [],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('soil_moisture');
  }

  if (
    evidence.precipitationTotalMm !== undefined &&
    evidence.precipitationTotalMm !== null &&
    evidence.tMaxAvgC !== undefined &&
    evidence.tMaxAvgC !== null
  ) {
    evidenceCategoriesSupplied += 1;
    const [lo, hi] = FUNGAL_FAVORABLE_TEMP_RANGE_C;
    if (evidence.precipitationTotalMm >= FUNGAL_FAVORABLE_PRECIP_MM && evidence.tMaxAvgC >= lo && evidence.tMaxAvgC <= hi) {
      riskFactors.push({
        type: 'favorable_fungal_conditions',
        description: `Recent window precipitation ${evidence.precipitationTotalMm.toFixed(1)}mm at or above ${FUNGAL_FAVORABLE_PRECIP_MM}mm with avg max temp ${evidence.tMaxAvgC.toFixed(1)}°C in the ${lo}-${hi}°C range generally favorable to foliar fungal pathogens.`,
        supportingObservationIds: evidence.weatherObservationId ? [evidence.weatherObservationId] : [],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('weather_window');
  }

  if (evidence.vegetationIndex !== undefined && evidence.vegetationIndex !== null) {
    evidenceCategoriesSupplied += 1;
    if (evidence.vegetationIndex.value < LOW_VEGETATION_INDEX_THRESHOLD) {
      riskFactors.push({
        type: 'vegetation_anomaly_undetermined_cause',
        description: `${evidence.vegetationIndex.type} = ${evidence.vegetationIndex.value.toFixed(3)}, below the generic ${LOW_VEGETATION_INDEX_THRESHOLD} attention threshold. Cause undetermined — may or may not be disease/pest related.`,
        supportingObservationIds: [evidence.vegetationIndex.id],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('vegetation_index');
  }

  if (evidence.hasCropObservation) {
    evidenceCategoriesSupplied += 1;
  } else {
    missingEvidence.push('crop_observation');
  }

  const status: DiseasePestRiskStatus =
    evidenceCategoriesSupplied === 0 ? 'INSUFFICIENT_DATA' : riskFactors.length > 0 ? 'ELEVATED_RISK' : 'NORMAL';

  return {
    id: createId('disease_pest'),
    fieldId: evidence.fieldId,
    zoneId: evidence.zoneId ?? null,
    status,
    riskFactors,
    missingEvidence,
    computedAt: Date.now(),
    method: 'rule_based_risk_factor_screening_v1'
  };
}
