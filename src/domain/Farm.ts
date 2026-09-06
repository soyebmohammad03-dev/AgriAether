import { createId } from './id';
import type { GeoReference } from './GeoReference';

export interface Farm {
  id: string;
  name: string;
  description: string | null;
  geoReference: GeoReference;
  areaHectares: number | null;
  timezone: string;
  createdAt: number;
  updatedAt: number;
}

export function createFarm(params: {
  name: string;
  description?: string | null;
  geoReference: GeoReference;
  areaHectares?: number | null;
  timezone?: string;
}): Farm {
  if (!params.name.trim()) {
    throw new Error('Farm requires a non-empty name');
  }
  const now = Date.now();
  return {
    id: createId('farm'),
    name: params.name,
    description: params.description ?? null,
    geoReference: params.geoReference,
    areaHectares: params.areaHectares ?? null,
    timezone: params.timezone ?? 'UTC',
    createdAt: now,
    updatedAt: now
  };
}
