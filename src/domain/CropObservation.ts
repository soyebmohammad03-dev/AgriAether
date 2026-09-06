import { createId } from './id';
import type { GrowthStage } from './Crop';
import type { Provenance } from '../observation/Observation';
import type { ObservationLocation } from '../observation/Observation';

/**
 * A single point-in-time crop observation — what someone or something saw,
 * once, at one place — distinct from CropCycle (Crop.ts), which is
 * slow-changing planting configuration. Many CropObservations can exist
 * across a CropCycle's lifetime (e.g. one growth-stage check per week);
 * they don't overwrite each other or the cycle record.
 *
 * There is deliberately no health score, disease flag, or stress index
 * here. `observedCondition` is a free-text field for what was actually
 * seen (e.g. "yellowing on lower leaves, lower third of canopy"), not a
 * classification — turning it into a diagnosis requires a validated
 * model/dataset this system does not yet have (see ModelRegistry.ts).
 */
export interface CropObservation {
  id: string;
  fieldId: string;
  zoneId: string | null;
  cropCycleId: string | null;
  cultivar: string | null;
  growthStage: GrowthStage;
  /** Free-text description of what was observed, or null if only growth stage was recorded. Never a fabricated score. */
  observedCondition: string | null;
  timestamp: number;
  location: ObservationLocation | null;
  source: Provenance;
  /** 0-1, or null when the provenance has no meaningful confidence (e.g. USER_REPORTED). */
  confidence: number | null;
}

export function createCropObservation(params: {
  fieldId: string;
  zoneId?: string | null;
  cropCycleId?: string | null;
  cultivar?: string | null;
  growthStage?: GrowthStage;
  observedCondition?: string | null;
  timestamp?: number;
  location?: ObservationLocation | null;
  source: Provenance;
  confidence?: number | null;
}): CropObservation {
  if (!params.fieldId) {
    throw new Error('CropObservation requires a fieldId');
  }
  if (params.confidence !== null && params.confidence !== undefined && (params.confidence < 0 || params.confidence > 1)) {
    throw new Error(`CropObservation has an out-of-range confidence: ${params.confidence}`);
  }
  return {
    id: createId('crop_obs'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    cropCycleId: params.cropCycleId ?? null,
    cultivar: params.cultivar ?? null,
    growthStage: params.growthStage ?? 'UNKNOWN',
    observedCondition: params.observedCondition ?? null,
    timestamp: params.timestamp ?? Date.now(),
    location: params.location ?? null,
    source: params.source,
    confidence: params.confidence ?? null
  };
}
