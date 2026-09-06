import { createId } from './id';
import type { GeoReference } from './GeoReference';

export type FieldStatus = 'active' | 'inactive' | 'unknown';

export interface Field {
  id: string;
  farmId: string;
  name: string;
  description: string | null;
  geoReference: GeoReference;
  areaHectares: number | null;
  status: FieldStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * farmId is taken as given here — this factory does not check the farm
 * exists. That referential check belongs to WorldRegistry, which is the
 * one place with a loaded farm collection to check against.
 */
export function createField(params: {
  farmId: string;
  name: string;
  description?: string | null;
  geoReference: GeoReference;
  areaHectares?: number | null;
  status?: FieldStatus;
}): Field {
  if (!params.farmId) {
    throw new Error('Field requires a farmId');
  }
  if (!params.name.trim()) {
    throw new Error('Field requires a non-empty name');
  }
  const now = Date.now();
  return {
    id: createId('field'),
    farmId: params.farmId,
    name: params.name,
    description: params.description ?? null,
    geoReference: params.geoReference,
    areaHectares: params.areaHectares ?? null,
    status: params.status ?? 'unknown',
    createdAt: now,
    updatedAt: now
  };
}
