import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { DataQuality } from './DataQuality';

/**
 * Every kind of derived agricultural result this codebase can currently
 * produce or represent. Deliberately does NOT include CROP_CONDITION or
 * DISEASE_DETECTED as a status any analysis can claim — see the module doc
 * below and Part 13 of the Phase 4 brief: those require a validated model
 * that does not exist yet.
 */
export type AgriculturalAnalysisType = 'VEGETATION_INDEX' | 'THERMAL_FEATURE' | 'SOIL_MEASUREMENT' | 'TEMPORAL_CHANGE' | 'SPATIAL_AGGREGATION';

/**
 * The generic shape every derived agricultural result takes, regardless of
 * whether it came from a deterministic formula (today) or a validated ML
 * model (future — see ModelRegistry.ts). `provenance` distinguishes the
 * two: ESTIMATED/SIMULATED for the deterministic analyses this phase
 * implements, PREDICTED once a real model produces one. Never MEASURED —
 * an analysis is by definition derived, not a direct instrument reading.
 */
export interface AgriculturalAnalysis {
  id: string;
  type: AgriculturalAnalysisType;
  fieldId: string | null;
  zoneId: string | null;
  /** e.g. "NDVI", "canopy_minus_air_temperature_difference" — matches the method name in the definition that produced it. */
  method: string;
  /** IDs of the Observations/readings this result was computed from — the lineage anchor. */
  inputObservationIds: string[];
  result: number | string | null;
  unit: string | null;
  confidence: number | null;
  quality: DataQuality;
  provenance: Provenance;
  computedAt: number;
  limitations: string | null;
}

export function createAgriculturalAnalysis(params: {
  type: AgriculturalAnalysisType;
  fieldId?: string | null;
  zoneId?: string | null;
  method: string;
  inputObservationIds: string[];
  result: number | string | null;
  unit?: string | null;
  confidence?: number | null;
  quality: DataQuality;
  provenance: Provenance;
  limitations?: string | null;
}): AgriculturalAnalysis {
  if (params.provenance === 'MEASURED') {
    throw new Error('An AgriculturalAnalysis is a derived result and can never claim provenance MEASURED');
  }
  return {
    id: createId('analysis'),
    type: params.type,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    method: params.method,
    inputObservationIds: params.inputObservationIds,
    result: params.result,
    unit: params.unit ?? null,
    confidence: params.confidence ?? null,
    quality: params.quality,
    provenance: params.provenance,
    computedAt: Date.now(),
    limitations: params.limitations ?? null
  };
}
