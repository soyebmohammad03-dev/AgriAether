import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { PlausibleRange } from '../sensing/Units';
import { assertValidLatLon } from '../geo/geometry';

export type SoilSampleMethod = 'FIELD_SAMPLING' | 'ZONE_SAMPLING' | 'LABORATORY' | 'GROUND_SENSOR' | 'EXTERNAL_DATASET' | 'SIMULATION';

/** USDA textural triangle classes — the standard 12-class soil texture taxonomy. Never inferred from imagery; only ever set from an actual lab/field texture determination. */
export const SOIL_TEXTURE_CLASSES = [
  'SAND',
  'LOAMY_SAND',
  'SANDY_LOAM',
  'LOAM',
  'SILT_LOAM',
  'SILT',
  'SANDY_CLAY_LOAM',
  'CLAY_LOAM',
  'SILTY_CLAY_LOAM',
  'SANDY_CLAY',
  'SILTY_CLAY',
  'CLAY'
] as const;
export type SoilTextureClass = (typeof SOIL_TEXTURE_CLASSES)[number];

/** Which method implies which provenance — enforced by createSoilSample so a method and its provenance can never disagree (e.g. a SIMULATION sample claiming MEASURED). */
const METHOD_PROVENANCE: Record<SoilSampleMethod, Provenance> = {
  FIELD_SAMPLING: 'MEASURED',
  ZONE_SAMPLING: 'MEASURED',
  LABORATORY: 'MEASURED',
  GROUND_SENSOR: 'MEASURED',
  EXTERNAL_DATASET: 'EXTERNAL',
  SIMULATION: 'SIMULATED'
};

export interface SoilMeasurements {
  moisturePercent?: number;
  temperatureC?: number;
  ec?: number;
  ph?: number;
  nitrogenPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
}

const MEASUREMENT_UNITS: Record<keyof SoilMeasurements, string> = {
  moisturePercent: 'percent',
  temperatureC: 'degC',
  ec: 'dS/m',
  ph: 'pH',
  nitrogenPpm: 'ppm',
  phosphorusPpm: 'ppm',
  potassiumPpm: 'ppm'
};

/**
 * Generous real-world bounds (same philosophy as GroundSample's
 * MEASUREMENT_PLAUSIBLE_RANGES), used by SoilQuality.ts to flag
 * OUT_OF_RANGE — never to reject or clamp a value outright.
 */
export const MEASUREMENT_PLAUSIBLE_RANGES: Record<keyof SoilMeasurements, PlausibleRange> = {
  moisturePercent: { min: 0, max: 100 }, // volumetric or gravimetric water content
  temperatureC: { min: -20, max: 60 }, // below-frost to desert-surface soil
  ec: { min: 0, max: 30 }, // non-saline to brine-adjacent
  ph: { min: 0, max: 14 }, // full aqueous pH scale
  nitrogenPpm: { min: 0, max: 2000 },
  phosphorusPpm: { min: 0, max: 2000 },
  potassiumPpm: { min: 0, max: 2000 }
};

/**
 * One soil sample/reading. `sensorId` is required when method is
 * GROUND_SENSOR — see assertSoilSampleSensorCapable, which checks the
 * referenced sensor actually declares capability for every measurement
 * present here (the mechanism that keeps "RGB camera -> soil moisture"
 * impossible for soil data specifically). `location`/`textureClass` are
 * both optional and never inferred — a texture class must come from an
 * actual lab/field determination, never guessed from imagery or moisture
 * readings alone.
 */
export interface SoilSample {
  id: string;
  fieldId: string;
  zoneId: string | null;
  /** WGS84 point where the sample was actually taken — distinct from, and finer-grained than, fieldId/zoneId. Null when only the field/zone is known. Prepares for future spatial interpolation; no interpolation is implemented here. */
  location: { lat: number; lon: number } | null;
  depthCm: number | null;
  timestamp: number;
  method: SoilSampleMethod;
  laboratoryOrProvider: string | null;
  sensorId: string | null;
  measurements: SoilMeasurements;
  textureClass: SoilTextureClass | null;
  provenance: Provenance;
  /** 0-1, or null when the method has no meaningful confidence (e.g. a certified lab assay) — never fabricated. */
  confidence: number | null;
}

export function createSoilSample(params: {
  fieldId: string;
  zoneId?: string | null;
  location?: { lat: number; lon: number } | null;
  depthCm?: number | null;
  timestamp?: number;
  method: SoilSampleMethod;
  laboratoryOrProvider?: string | null;
  sensorId?: string | null;
  measurements: SoilMeasurements;
  textureClass?: SoilTextureClass | null;
  confidence?: number | null;
}): SoilSample {
  if (!params.fieldId) {
    throw new Error('SoilSample requires a fieldId');
  }
  if (Object.keys(params.measurements).length === 0 && !params.textureClass) {
    throw new Error('SoilSample must contain at least one measurement or a texture class');
  }
  if (params.method === 'GROUND_SENSOR' && !params.sensorId) {
    throw new Error('SoilSample with method GROUND_SENSOR requires a sensorId');
  }
  if (params.location) {
    assertValidLatLon(params.location.lat, params.location.lon);
  }
  if (params.confidence !== null && params.confidence !== undefined && (params.confidence < 0 || params.confidence > 1)) {
    throw new Error(`SoilSample confidence must be between 0 and 1, got ${params.confidence}`);
  }
  return {
    id: createId('soil_sample'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    location: params.location ?? null,
    depthCm: params.depthCm ?? null,
    timestamp: params.timestamp ?? Date.now(),
    method: params.method,
    laboratoryOrProvider: params.laboratoryOrProvider ?? null,
    sensorId: params.sensorId ?? null,
    measurements: params.measurements,
    textureClass: params.textureClass ?? null,
    provenance: METHOD_PROVENANCE[params.method],
    confidence: params.confidence ?? null
  };
}

export function unitForMeasurement(key: keyof SoilMeasurements): string {
  return MEASUREMENT_UNITS[key];
}
