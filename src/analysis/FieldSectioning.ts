import { createZone, type Zone } from '../domain/Zone';
import { areaHectares } from '../geo/geometry';
import { computeSpatialStatistics } from '../data/SpatialStatistics';
import type { RasterGrid } from '../data/Raster';
import type { DataQuality } from '../sensing/DataQuality';
import type { Polygon, MultiPolygon } from 'geojson';

/**
 * Evidence-based management-zone generation — the first real producer of
 * `Zone.classification = 'GIS_DERIVED'` (see domain/Zone.ts, which reserved
 * this value since Phase 2 explicitly for this). Deterministic throughout:
 * seeded-by-sorted-value k-means (never Math.random), then a 4-connected
 * flood fill over the raster grid to turn per-cell cluster labels into
 * spatial regions, then a documented minimum-region-size filter.
 *
 * A zone here means exactly one thing: "this region's NDVI was sufficiently
 * similar under this clustering, at this resolution, on this date." It is
 * NOT a claim about soil, disease, yield, or treatment need — those require
 * their own evidence (see irrigation/soil/crop-stress modules), which a
 * zone can carry as `ZoneGenerationRecord.sourceObservationIds` but never
 * fabricates on its own.
 */

export interface ZoneCellFeature {
  row: number;
  col: number;
  value: number;
}

export interface ZoneGenerationRecord {
  zoneId: string;
  fieldId: string;
  method: string;
  version: string;
  parameters: Record<string, string | number | boolean>;
  featureNames: string[];
  normalization: string;
  minRegionCells: number;
  sourceObservationIds: string[];
  sourceDatasetIds: string[];
  cellCount: number;
  coverageFraction: number;
  areaHectares: number;
  meanNdvi: number | null;
  ndviStdDev: number | null;
  quality: DataQuality;
  generatedAt: number;
}

export interface FieldSectioningResult {
  zones: Zone[];
  generationRecords: ZoneGenerationRecord[];
  /** Cells that clustered but whose connected region was below minRegionCells — reported honestly, never silently absorbed into a neighboring zone. */
  unassignedCellCount: number;
  totalCellCount: number;
}

const METHOD_NAME = 'kmeans_ndvi_connected_components';
const METHOD_VERSION = '1.0.0';
const DEFAULT_K = 3;
const DEFAULT_MIN_REGION_CELLS = 4;
const DEFAULT_MAX_ITERATIONS = 25;

/** Deterministic 1D k-means: centroids seeded from evenly-spaced quantiles of the SORTED values — never Math.random, never data order. Given identical input this always converges to the identical assignment. */
function deterministicKMeans1D(values: number[], k: number, maxIterations: number): number[] {
  const n = values.length;
  const effectiveK = Math.min(k, n);
  const sorted = [...values].sort((a, b) => a - b);
  let centroids = Array.from({ length: effectiveK }, (_, i) => sorted[Math.floor(((i + 0.5) / effectiveK) * n)]);

  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIterations; iter++) {
    const newAssignments = values.map((v) => {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dist = Math.abs(v - centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return best;
    });

    const converged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;
    if (converged) break;

    centroids = centroids.map((c, ci) => {
      const members = values.filter((_, i) => assignments[i] === ci);
      return members.length > 0 ? members.reduce((s, v) => s + v, 0) / members.length : c;
    });
  }
  return assignments;
}

/** 4-connected flood fill over (row,col) cells sharing the same cluster label — the deterministic "region growing" step turning per-cell labels into spatial groups. */
function connectedComponents(cells: ZoneCellFeature[], labels: number[]): Array<{ label: number; cells: ZoneCellFeature[] }> {
  const cellByKey = new Map<string, { cell: ZoneCellFeature; label: number; index: number }>();
  cells.forEach((cell, i) => cellByKey.set(`${cell.row},${cell.col}`, { cell, label: labels[i], index: i }));

  const visited = new Set<string>();
  const regions: Array<{ label: number; cells: ZoneCellFeature[] }> = [];

  // Iterate in stable (row, col) order so region discovery order — and therefore zone numbering — is deterministic.
  const orderedKeys = [...cellByKey.keys()].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number);
    const [br, bc] = b.split(',').map(Number);
    return ar - br || ac - bc;
  });

  for (const startKey of orderedKeys) {
    if (visited.has(startKey)) continue;
    const start = cellByKey.get(startKey)!;
    const queue = [startKey];
    visited.add(startKey);
    const regionCells: ZoneCellFeature[] = [];

    while (queue.length > 0) {
      const key = queue.shift()!;
      const entry = cellByKey.get(key)!;
      regionCells.push(entry.cell);
      const [row, col] = key.split(',').map(Number);
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]) {
        const neighborKey = `${row + dr},${col + dc}`;
        const neighbor = cellByKey.get(neighborKey);
        if (neighbor && neighbor.label === start.label && !visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push(neighborKey);
        }
      }
    }
    regions.push({ label: start.label, cells: regionCells });
  }

  return regions;
}

/** One cell's rectangle in lon/lat, derived from the raster's linear extent — same field-scale flat approximation this codebase already uses elsewhere (georeference.ts, Raster.ts's cellCenterLonLat). */
function cellRectangle(grid: RasterGrid, row: number, col: number): Polygon {
  const { lat, lon } = grid.cellCenterLonLat(row, col);
  const [minLon, minLat, maxLon, maxLat] = grid.metadata.extent;
  const halfWidthLon = (maxLon - minLon) / grid.metadata.widthPx / 2;
  const halfHeightLat = (maxLat - minLat) / grid.metadata.heightPx / 2;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - halfWidthLon, lat - halfHeightLat],
        [lon + halfWidthLon, lat - halfHeightLat],
        [lon + halfWidthLon, lat + halfHeightLat],
        [lon - halfWidthLon, lat + halfHeightLat],
        [lon - halfWidthLon, lat - halfHeightLat]
      ]
    ]
  };
}

/**
 * Generates GIS_DERIVED management zones from real per-pixel NDVI (the
 * only spatial evidence this codebase's real Sentinel-2 pipeline currently
 * produces — see satellite/SentinelFieldPipeline.ts). Additional aligned
 * evidence layers (soil moisture, elevation) are accepted as optional
 * future feature dimensions but never fabricated when absent — this
 * function honestly reports `featureNames: ['NDVI']` when that's all it
 * had.
 */
export function generateFieldSections(params: {
  fieldId: string;
  grid: RasterGrid;
  ndviCells: readonly ZoneCellFeature[];
  sourceObservationIds: string[];
  sourceDatasetIds: string[];
  k?: number;
  minRegionCells?: number;
  maxIterations?: number;
}): FieldSectioningResult {
  const k = params.k ?? DEFAULT_K;
  const minRegionCells = params.minRegionCells ?? DEFAULT_MIN_REGION_CELLS;
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const cells = [...params.ndviCells].sort((a, b) => a.row - b.row || a.col - b.col);

  if (cells.length === 0) {
    return { zones: [], generationRecords: [], unassignedCellCount: 0, totalCellCount: 0 };
  }

  const values = cells.map((c) => c.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const normalized = range > 0 ? values.map((v) => (v - min) / range) : values.map(() => 0);

  const labels = deterministicKMeans1D(normalized, k, maxIterations);
  const regions = connectedComponents(cells, labels);

  const zones: Zone[] = [];
  const generationRecords: ZoneGenerationRecord[] = [];
  let unassignedCellCount = 0;
  const now = Date.now();

  const survivingRegions = regions.filter((region) => region.cells.length >= minRegionCells);
  for (const region of regions) {
    if (region.cells.length < minRegionCells) unassignedCellCount += region.cells.length;
  }

  survivingRegions.forEach((region, index) => {
      const geometry: MultiPolygon = { type: 'MultiPolygon', coordinates: region.cells.map((c) => cellRectangle(params.grid, c.row, c.col).coordinates) };
      const ndviValues = region.cells.map((c) => c.value);
      const meanStat = computeSpatialStatistics(ndviValues, region.cells.length, 'mean');
      const stddevStat = computeSpatialStatistics(ndviValues, region.cells.length, 'stddev');

      const zone = createZone({
        fieldId: params.fieldId,
        name: `Section ${String.fromCharCode(65 + index)} (GIS-derived)`,
        classification: 'GIS_DERIVED',
        geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry, provenance: 'EXTERNAL' }
      });
      zones.push(zone);

      generationRecords.push({
        zoneId: zone.id,
        fieldId: params.fieldId,
        method: METHOD_NAME,
        version: METHOD_VERSION,
        parameters: { k, minRegionCells, maxIterations, clusterLabel: region.label },
        featureNames: ['NDVI'],
        normalization: 'min-max over the observed NDVI range for this field/date',
        minRegionCells,
        sourceObservationIds: params.sourceObservationIds,
        sourceDatasetIds: params.sourceDatasetIds,
        cellCount: region.cells.length,
        coverageFraction: region.cells.length / cells.length,
        areaHectares: areaHectares(geometry),
        meanNdvi: meanStat.value,
        ndviStdDev: stddevStat.value,
        quality: meanStat.quality,
        generatedAt: now
      });
    });

  return { zones, generationRecords, unassignedCellCount, totalCellCount: cells.length };
}
