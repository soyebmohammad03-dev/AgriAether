import { createId } from './id';
import type { Provenance } from '../observation/Observation';

export type AgriculturalEventType =
  | 'PLANTING'
  | 'HARVEST'
  | 'TREATMENT'
  | 'INSPECTION'
  | 'MISSION_STARTED'
  | 'MISSION_COMPLETED'
  | 'OTHER';

/**
 * A discrete thing that happened on a field — as opposed to an Observation,
 * which is a continuous or point-in-time measurement. Phase 2 only emits
 * MISSION_STARTED, from a real flight-state transition; the rest of the
 * type exists so planting/treatment/harvest logging has somewhere to land
 * later without a schema change.
 */
export interface AgriculturalEvent {
  id: string;
  fieldId: string;
  zoneId: string | null;
  type: AgriculturalEventType;
  description: string;
  timestamp: number;
  source: Provenance;
}

export function createAgriculturalEvent(params: {
  fieldId: string;
  zoneId?: string | null;
  type: AgriculturalEventType;
  description: string;
  timestamp?: number;
  source: Provenance;
}): AgriculturalEvent {
  if (!params.fieldId) {
    throw new Error('AgriculturalEvent requires a fieldId');
  }
  return {
    id: createId('event'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    type: params.type,
    description: params.description,
    timestamp: params.timestamp ?? Date.now(),
    source: params.source
  };
}
