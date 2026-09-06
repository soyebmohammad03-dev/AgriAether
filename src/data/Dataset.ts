import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { DataQuality } from '../sensing/DataQuality';

export type DatasetType = 'RASTER' | 'VECTOR' | 'TABULAR' | 'IMAGERY' | 'SENSOR_SERIES' | 'WEATHER';

/**
 * The registry record for one dataset — imagery, a field boundary, a raster,
 * a sensor time series. Every derived artifact (a Raster, a FieldRasterSubset,
 * an AgriculturalAnalysis) should be traceable back to one of these; nothing
 * in this codebase invents an agricultural result without a dataset (real,
 * fixture, or the live simulation/weather pipelines already tagging their
 * own provenance) behind it.
 */
export interface DatasetRecord {
  id: string;
  name: string;
  /** Who produced the data, e.g. "AgriAether fixture", "Open-Meteo", "user upload". */
  provider: string;
  /** Where it came from — a URL, file path, or description. Never executed or fetched from this field automatically. */
  source: string;
  type: DatasetType;
  acquiredAtStart: number;
  /** null for a single point-in-time acquisition. */
  acquiredAtEnd: number | null;
  /** [minLon, minLat, maxLon, maxLat] in `crs`, or null if not georeferenced. */
  spatialExtent: [number, number, number, number] | null;
  crs: 'EPSG:4326' | null;
  resolutionMeters: number | null;
  /** Band names for RASTER/IMAGERY datasets; null for non-band data. Never assumed — see sensing/SpectralBand.ts for how a band's identity is established from metadata, not position. */
  bands: string[] | null;
  license: string | null;
  attribution: string | null;
  provenance: Provenance;
  quality: DataQuality;
  fieldId: string | null;
  createdAt: number;
}

export function createDatasetRecord(params: {
  name: string;
  provider: string;
  source: string;
  type: DatasetType;
  acquiredAtStart: number;
  acquiredAtEnd?: number | null;
  spatialExtent?: [number, number, number, number] | null;
  crs?: 'EPSG:4326' | null;
  resolutionMeters?: number | null;
  bands?: string[] | null;
  license?: string | null;
  attribution?: string | null;
  provenance: Provenance;
  quality: DataQuality;
  fieldId?: string | null;
}): DatasetRecord {
  if ((params.type === 'RASTER' || params.type === 'IMAGERY') && !params.crs) {
    throw new Error(`Dataset "${params.name}" is ${params.type} but has no CRS — a raster/imagery dataset must be georeferenced or explicitly marked UNKNOWN elsewhere, never silently assumed`);
  }
  return {
    id: createId('dataset'),
    name: params.name,
    provider: params.provider,
    source: params.source,
    type: params.type,
    acquiredAtStart: params.acquiredAtStart,
    acquiredAtEnd: params.acquiredAtEnd ?? null,
    spatialExtent: params.spatialExtent ?? null,
    crs: params.crs ?? null,
    resolutionMeters: params.resolutionMeters ?? null,
    bands: params.bands ?? null,
    license: params.license ?? null,
    attribution: params.attribution ?? null,
    provenance: params.provenance,
    quality: params.quality,
    fieldId: params.fieldId ?? null,
    createdAt: Date.now()
  };
}
