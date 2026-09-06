import { createId } from './id';
import type { GeoReference } from './GeoReference';

/**
 * How this zone's boundary was determined. Phase 2 only ever creates
 * SIMULATED_MANAGEMENT_ZONE — a zone drawn for the demo environment with no
 * real soil/imagery analysis behind it. GIS_DERIVED (from real orthomosaic/
 * NDVI zoning) is a later-phase capability represented here so the type
 * doesn't need reshaping when it arrives.
 */
export type ZoneClassification = 'SIMULATED_MANAGEMENT_ZONE' | 'GIS_DERIVED' | 'UNKNOWN';

export interface Zone {
  id: string;
  fieldId: string;
  name: string;
  classification: ZoneClassification;
  geoReference: GeoReference;
  createdAt: number;
}

export function createZone(params: {
  fieldId: string;
  name: string;
  classification: ZoneClassification;
  geoReference: GeoReference;
}): Zone {
  if (!params.fieldId) {
    throw new Error('Zone requires a fieldId');
  }
  if (!params.name.trim()) {
    throw new Error('Zone requires a non-empty name');
  }
  return {
    id: createId('zone'),
    fieldId: params.fieldId,
    name: params.name,
    classification: params.classification,
    geoReference: params.geoReference,
    createdAt: Date.now()
  };
}
