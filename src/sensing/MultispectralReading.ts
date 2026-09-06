import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { ImageAsset } from './ImageAsset';
import type { SpectralBand } from './SpectralBand';

/**
 * A multispectral reading — per-band reflectance values for one location/
 * moment, not a full pixel raster (this codebase has no raster engine; see
 * the README's "What we deliberately did not build"). `bands` only ever
 * contains what the sensor actually captured — a 4-band sensor missing
 * RED_EDGE simply omits that key, it is never filled with a guess.
 *
 * `reflectanceOrRadiance` matters: radiance (raw sensor units) requires a
 * calibration step before it's physically comparable across captures;
 * reflectance (0-1, calibrated against a known reference) is what
 * SpectralIndex.ts's formulas assume. An uncalibrated radiance reading
 * cannot legitimately feed an index calculation — see IndexEngine.ts.
 */
export interface MultispectralReading {
  id: string;
  sourceAsset: ImageAsset | null;
  /** Reflectance (unitless, 0-1) per band this sensor actually has, or radiance (raw sensor units) if not yet calibrated. */
  bands: Partial<Record<SpectralBand, number>>;
  unitKind: 'reflectance' | 'radiance';
  capturedAt: number;
  sensorId: string | null;
  fieldId: string | null;
  zoneId: string | null;
  location: { crs: 'EPSG:4326'; lat: number; lon: number } | { frame: 'simulation-local'; x: number; y: number; z: number } | null;
  provenance: Provenance;
}

export function createMultispectralReading(params: {
  sourceAsset?: ImageAsset | null;
  bands: Partial<Record<SpectralBand, number>>;
  unitKind: 'reflectance' | 'radiance';
  capturedAt: number;
  sensorId?: string | null;
  fieldId?: string | null;
  zoneId?: string | null;
  location?: MultispectralReading['location'];
  provenance: Provenance;
}): MultispectralReading {
  if (Object.keys(params.bands).length === 0) {
    throw new Error('MultispectralReading must contain at least one band');
  }
  if (params.unitKind === 'reflectance') {
    for (const [band, value] of Object.entries(params.bands)) {
      if (value !== undefined && (value < 0 || value > 1)) {
        throw new Error(`MultispectralReading band ${band} = ${value} is out of the valid reflectance range [0, 1]`);
      }
    }
  }
  return {
    id: createId('multispectral_reading'),
    sourceAsset: params.sourceAsset ?? null,
    bands: params.bands,
    unitKind: params.unitKind,
    capturedAt: params.capturedAt,
    sensorId: params.sensorId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    location: params.location ?? null,
    provenance: params.provenance
  };
}
