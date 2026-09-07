import { createId } from '../domain/id';
import type { MoistureStatus, EcStatus } from '../soil/SoilQuality';

export type CropStressStatus = 'NORMAL' | 'ATTENTION' | 'INSUFFICIENT_DATA';

export interface CropStressSignal {
  /** e.g. "low_vegetation_index", "soil_moisture_deficit" — a correlation flag, never a diagnosis. */
  type: string;
  description: string;
  supportingObservationIds: string[];
  confidence: number | null;
}

export interface CropStressAssessment {
  id: string;
  fieldId: string;
  zoneId: string | null;
  status: CropStressStatus;
  signals: CropStressSignal[];
  /** Evidence categories that were not supplied to this assessment — the honest complement to `signals`. */
  missingEvidence: string[];
  computedAt: number;
  method: string;
}

/** Generic vegetation-vigor threshold — not crop-specific, not a health score. Values below this on a well-established index (NDVI/GNDVI-family, all range roughly [-1,1] with healthy canopy typically well above this) are flagged as worth attention, nothing more. */
const LOW_VEGETATION_INDEX_THRESHOLD = 0.3;
/** Generic heat-stress threshold (°C) — widely-cited rough onset of heat stress for many temperate/row crops; not calibrated to any specific cultivar. */
const HEAT_STRESS_TMAX_C = 38;

export interface CropStressEvidence {
  fieldId: string;
  zoneId?: string | null;
  /** A recent vegetation-index Observation (see indexResultToObservation.ts), if one exists. */
  vegetationIndex?: { id: string; type: string; value: number } | null;
  /** A recent SoilSample's quality summary, if one exists. */
  soilMoistureStatus?: MoistureStatus | null;
  soilEcStatus?: EcStatus | null;
  soilSampleId?: string | null;
  /** A recent daily weather record's max temperature, if one exists. */
  recentTMaxC?: number | null;
  weatherObservationId?: string | null;
  /** Whether at least one CropObservation exists for this field — presence alone, not its content, since observedCondition is free text with no validated taxonomy to flag on. */
  hasCropObservation?: boolean;
}

/**
 * A conservative, evidence-oriented stress screen — combines whatever
 * real evidence is actually supplied (vegetation index, soil quality,
 * weather, crop observation presence) into a small set of correlation
 * flags. Explicitly NOT a diagnosis: no disease claim, no causal claim, no
 * recommendation. `status` is INSUFFICIENT_DATA whenever no evidence
 * category was supplied at all, ATTENTION when at least one signal fired,
 * NORMAL when evidence exists and none fired.
 */
export function assessCropStress(evidence: CropStressEvidence): CropStressAssessment {
  const signals: CropStressSignal[] = [];
  const missingEvidence: string[] = [];
  let evidenceCategoriesSupplied = 0;

  if (evidence.vegetationIndex !== undefined && evidence.vegetationIndex !== null) {
    evidenceCategoriesSupplied += 1;
    if (evidence.vegetationIndex.value < LOW_VEGETATION_INDEX_THRESHOLD) {
      signals.push({
        type: 'low_vegetation_index',
        description: `${evidence.vegetationIndex.type} = ${evidence.vegetationIndex.value.toFixed(3)}, below the generic ${LOW_VEGETATION_INDEX_THRESHOLD} attention threshold.`,
        supportingObservationIds: [evidence.vegetationIndex.id],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('vegetation_index');
  }

  if (evidence.soilMoistureStatus !== undefined && evidence.soilMoistureStatus !== null) {
    evidenceCategoriesSupplied += 1;
    if (evidence.soilMoistureStatus === 'DRY') {
      signals.push({
        type: 'soil_moisture_deficit',
        description: 'Most recent soil sample classifies as DRY.',
        supportingObservationIds: evidence.soilSampleId ? [evidence.soilSampleId] : [],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('soil_moisture');
  }

  if (evidence.soilEcStatus !== undefined && evidence.soilEcStatus !== null) {
    if (evidence.soilEcStatus === 'SALINE' || evidence.soilEcStatus === 'HIGH') {
      signals.push({
        type: 'elevated_soil_salinity',
        description: `Most recent soil sample classifies EC as ${evidence.soilEcStatus}.`,
        supportingObservationIds: evidence.soilSampleId ? [evidence.soilSampleId] : [],
        confidence: null
      });
    }
  }

  if (evidence.recentTMaxC !== undefined && evidence.recentTMaxC !== null) {
    evidenceCategoriesSupplied += 1;
    if (evidence.recentTMaxC >= HEAT_STRESS_TMAX_C) {
      signals.push({
        type: 'heat_stress_conditions',
        description: `Recent daily max temperature ${evidence.recentTMaxC.toFixed(1)}°C at or above the generic ${HEAT_STRESS_TMAX_C}°C threshold.`,
        supportingObservationIds: evidence.weatherObservationId ? [evidence.weatherObservationId] : [],
        confidence: null
      });
    }
  } else {
    missingEvidence.push('weather');
  }

  if (evidence.hasCropObservation) {
    evidenceCategoriesSupplied += 1;
  } else {
    missingEvidence.push('crop_observation');
  }

  const status: CropStressStatus = evidenceCategoriesSupplied === 0 ? 'INSUFFICIENT_DATA' : signals.length > 0 ? 'ATTENTION' : 'NORMAL';

  return {
    id: createId('crop_stress'),
    fieldId: evidence.fieldId,
    zoneId: evidence.zoneId ?? null,
    status,
    signals,
    missingEvidence,
    computedAt: Date.now(),
    method: 'rule_based_evidence_aggregation_v1'
  };
}
