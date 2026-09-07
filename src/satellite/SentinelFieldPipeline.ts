import type { Polygon } from 'geojson';
import { createId } from '../domain/id';
import { clipRasterToGeometry, readClippedBandValues, type FieldRasterSubset } from '../data/FieldClip';
import { computeSpatialStatistics, type SpatialStatisticsResult } from '../data/SpatialStatistics';
import { createMultispectralReading } from '../sensing/MultispectralReading';
import { calculateIndex } from '../sensing/IndexEngine';
import { indexResultToObservation } from '../sensing/indexResultToObservation';
import { SPECTRAL_INDEX_DEFINITIONS } from '../sensing/SpectralIndex';
import type { SpectralBand } from '../sensing/SpectralBand';
import type { DataQuality } from '../sensing/DataQuality';
import { assertValidObservation, type Observation } from '../observation/Observation';
import type { RasterGrid } from '../data/Raster';
import type { SentinelSceneSummary } from './SentinelTypes';

/** Above this cloud-cover percentage a scene is still usable (selectBestScene already filters harder by default) but the resulting analysis is flagged QUESTIONABLE rather than VALID. */
const CLOUD_COVER_QUESTIONABLE_THRESHOLD = 20;
const COVERAGE_QUESTIONABLE_THRESHOLD = 0.5;

export interface SentinelFieldAnalysisResult {
  scene: SentinelSceneSummary;
  grid: RasterGrid;
  subset: FieldRasterSubset;
  redStats: SpatialStatisticsResult;
  nirStats: SpatialStatisticsResult;
  ndviStats: {
    mean: SpatialStatisticsResult;
    min: SpatialStatisticsResult;
    max: SpatialStatisticsResult;
    median: SpatialStatisticsResult;
    stddev: SpatialStatisticsResult;
  };
  /** The field-mean NDVI as a canonical Observation, produced through the exact production IndexEngine path (calculateIndex -> indexResultToObservation) — null only when neither band had a valid field-mean value. */
  ndviObservation: Observation<number> | null;
  /** Raw field-mean reflectance per band, provenance EXTERNAL — the real measured-by-satellite input the NDVI Observation above was derived from. */
  rawBandObservations: Observation<number>[];
  /** Per-pixel NDVI, clipped to the field geometry — the real data behind ndviStats, exposed for visualization (see ui/SatelliteFieldView.ts). */
  ndviCells: Array<{ row: number; col: number; value: number }>;
  validPixelCount: number;
  totalPixelCount: number;
  quality: DataQuality;
}

function buildRawBandObservations(params: {
  grid: RasterGrid;
  scene: SentinelSceneSummary;
  fieldId: string;
  zoneId: string | null;
  redMean: number | null;
  nirMean: number | null;
}): Observation<number>[] {
  const observations: Observation<number>[] = [];
  const entries: Array<[string, number | null]> = [
    ['remote_sensing.reflectance.red', params.redMean],
    ['remote_sensing.reflectance.nir', params.nirMean]
  ];
  for (const [type, value] of entries) {
    if (value === null) continue;
    const obs: Observation<number> = {
      id: createId(`obs_${type}`),
      type,
      value,
      unit: 'reflectance',
      timestamp: params.grid.metadata.acquiredAt,
      location: null,
      source: 'external:sentinel-2-l2a',
      provenance: 'EXTERNAL',
      confidence: null,
      status: 'OK',
      fieldId: params.fieldId,
      zoneId: params.zoneId,
      metadata: {
        sceneId: params.scene.itemId,
        cloudCoverPercent: params.scene.cloudCoverPercent ?? -1,
        processingBaseline: params.scene.processingBaseline ?? 'unknown'
      }
    };
    assertValidObservation(obs);
    observations.push(obs);
  }
  return observations;
}

/**
 * The clip -> per-pixel-NDVI -> statistics -> Observation stage of the
 * pipeline, built entirely from EXISTING modules: data/FieldClip.ts for
 * clipping, data/SpatialStatistics.ts for every statistic (mean/min/max/
 * median/stddev — none reimplemented here), sensing/SpectralIndex.ts's own
 * NDVI formula for the per-pixel calculation, and sensing/IndexEngine.ts +
 * sensing/indexResultToObservation.ts for the canonical field-mean
 * Observation, unmodified. Never returns an empty-looking success: a field
 * that doesn't intersect the raster throws rather than producing zeroed
 * statistics.
 */
export function analyzeFieldFromSentinelRaster(params: {
  grid: RasterGrid;
  scene: SentinelSceneSummary;
  fieldGeometry: Polygon;
  fieldId: string;
  zoneId?: string | null;
}): SentinelFieldAnalysisResult {
  const zoneId = params.zoneId ?? null;
  const subset = clipRasterToGeometry({ grid: params.grid, geometry: params.fieldGeometry, fieldId: params.fieldId, zoneId });
  if (subset.cellIndices.length === 0) {
    throw new Error(`Field "${params.fieldId}" does not intersect the retrieved Sentinel-2 raster window — refusing to produce an empty analysis.`);
  }

  const redValues = readClippedBandValues(params.grid, subset, 'RED');
  const nirValues = readClippedBandValues(params.grid, subset, 'NIR');
  const redStats = computeSpatialStatistics(redValues, subset.cellIndices.length, 'mean');
  const nirStats = computeSpatialStatistics(nirValues, subset.cellIndices.length, 'mean');

  const ndviValues: number[] = [];
  const ndviCells: Array<{ row: number; col: number; value: number }> = [];
  for (const { row, col } of subset.cellIndices) {
    const red = params.grid.getCell('RED', row, col);
    const nir = params.grid.getCell('NIR', row, col);
    if (red === null || nir === null) continue;
    const value = SPECTRAL_INDEX_DEFINITIONS.NDVI.calculate({ RED: red, NIR: nir } as Record<SpectralBand, number>);
    ndviValues.push(value);
    ndviCells.push({ row, col, value });
  }

  const ndviStats = {
    mean: computeSpatialStatistics(ndviValues, subset.cellIndices.length, 'mean'),
    min: computeSpatialStatistics(ndviValues, subset.cellIndices.length, 'min'),
    max: computeSpatialStatistics(ndviValues, subset.cellIndices.length, 'max'),
    median: computeSpatialStatistics(ndviValues, subset.cellIndices.length, 'median'),
    stddev: computeSpatialStatistics(ndviValues, subset.cellIndices.length, 'stddev')
  };

  let ndviObservation: Observation<number> | null = null;
  if (redStats.value !== null && nirStats.value !== null) {
    const reading = createMultispectralReading({
      bands: { RED: redStats.value, NIR: nirStats.value },
      unitKind: 'reflectance',
      capturedAt: params.grid.metadata.acquiredAt,
      fieldId: params.fieldId,
      zoneId,
      provenance: 'EXTERNAL'
    });
    const indexResult = calculateIndex('NDVI', reading);
    ndviObservation = indexResultToObservation(indexResult, reading, { fieldId: params.fieldId, zoneId });
  }

  const rawBandObservations = buildRawBandObservations({
    grid: params.grid,
    scene: params.scene,
    fieldId: params.fieldId,
    zoneId,
    redMean: redStats.value,
    nirMean: nirStats.value
  });

  const validPixelCount = ndviValues.length;
  const totalPixelCount = subset.cellIndices.length;
  const coverageFraction = totalPixelCount > 0 ? validPixelCount / totalPixelCount : 0;
  const highCloudCover = params.scene.cloudCoverPercent !== null && params.scene.cloudCoverPercent > CLOUD_COVER_QUESTIONABLE_THRESHOLD;
  const quality: DataQuality = validPixelCount === 0 ? 'INSUFFICIENT_DATA' : highCloudCover || coverageFraction < COVERAGE_QUESTIONABLE_THRESHOLD ? 'QUESTIONABLE' : 'VALID';

  return { scene: params.scene, grid: params.grid, subset, redStats, nirStats, ndviStats, ndviObservation, rawBandObservations, ndviCells, validPixelCount, totalPixelCount, quality };
}
