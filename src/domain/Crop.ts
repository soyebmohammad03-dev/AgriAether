import { createId } from './id';
import type { Provenance } from '../observation/Observation';

export interface CropType {
  id: string;
  commonName: string;
  scientificName: string | null;
}

export type GrowthStage = 'UNKNOWN' | 'PLANTED' | 'EMERGENCE' | 'VEGETATIVE' | 'FLOWERING' | 'MATURITY' | 'HARVESTED';

/**
 * What is planted where, and how confidently we know it. Unlike telemetry,
 * this is slow-changing configuration state, not a point-in-time reading —
 * that's why it's a domain entity rather than a stream of Observations.
 * Every field defaults to "we don't know" rather than a guessed value.
 */
export interface CropCycle {
  id: string;
  fieldId: string;
  zoneId: string | null;
  cropTypeId: string | null;
  plantingDate: number | null;
  harvestDate: number | null;
  growthStage: GrowthStage;
  /** Free-text description if known (e.g. "drip, twice weekly"); null means genuinely unknown, never inferred from the field/zone existing. */
  irrigationRegime: string | null;
  /** How this record came to exist — e.g. USER_REPORTED for a farmer-entered planting date, UNKNOWN if nothing is known yet. */
  source: Provenance;
}

export function createCropType(params: { commonName: string; scientificName?: string | null }): CropType {
  if (!params.commonName.trim()) {
    throw new Error('CropType requires a non-empty commonName');
  }
  return {
    id: createId('croptype'),
    commonName: params.commonName,
    scientificName: params.scientificName ?? null
  };
}

export function createCropCycle(params: {
  fieldId: string;
  zoneId?: string | null;
  cropTypeId?: string | null;
  plantingDate?: number | null;
  harvestDate?: number | null;
  growthStage?: GrowthStage;
  irrigationRegime?: string | null;
  source?: Provenance;
}): CropCycle {
  if (!params.fieldId) {
    throw new Error('CropCycle requires a fieldId');
  }
  return {
    id: createId('cropcycle'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    cropTypeId: params.cropTypeId ?? null,
    plantingDate: params.plantingDate ?? null,
    harvestDate: params.harvestDate ?? null,
    growthStage: params.growthStage ?? 'UNKNOWN',
    irrigationRegime: params.irrigationRegime ?? null,
    source: params.source ?? 'UNKNOWN'
  };
}
