import { createId } from '../domain/id';
import { assertValidObservation, type Observation, type ObservationContext } from '../observation/Observation';
import type { IndexCalculationResult } from './IndexEngine';
import type { MultispectralReading } from './MultispectralReading';

/**
 * Turns a successful vegetation-index calculation into the canonical
 * Observation shape — the seam that lets TemporalChange.ts and
 * SpatialAggregation.ts (both generic over any Observation<number>) work on
 * vegetation indices for free, without either module knowing what NDVI is.
 * Returns null for anything other than status 'OK' (UNSUPPORTED/
 * INSUFFICIENT_DATA) — an index that couldn't be computed produces no
 * Observation, never a placeholder value.
 */
export function indexResultToObservation(result: IndexCalculationResult, reading: MultispectralReading, context: ObservationContext = {}): Observation<number> | null {
  if (result.status !== 'OK' || result.value === null) return null;

  const location =
    reading.location && 'crs' in reading.location
      ? { frame: 'geodetic' as const, crs: reading.location.crs, lat: reading.location.lat, lon: reading.location.lon }
      : reading.location && 'frame' in reading.location
        ? reading.location
        : null;

  const obs: Observation<number> = {
    id: createId(`obs_vegetation_index_${result.indexId.toLowerCase()}`),
    type: `vegetation_index.${result.indexId.toLowerCase()}`,
    value: result.value,
    unit: null,
    timestamp: reading.capturedAt,
    location,
    source: `derived:index:${result.indexId.toLowerCase()}`,
    provenance: 'ESTIMATED',
    confidence: null,
    status: 'OK',
    fieldId: reading.fieldId,
    zoneId: reading.zoneId,
    sensorId: reading.sensorId,
    metadata: { method: result.method, quality: result.quality },
    ...context
  };
  assertValidObservation(obs);
  return obs;
}
