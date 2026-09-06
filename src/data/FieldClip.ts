import { createId } from '../domain/id';
import type { Polygon, MultiPolygon } from 'geojson';
import { isPointInPolygon } from '../geo/geometry';
import { RasterGrid } from './Raster';
import { recordProcessingStep, type ProcessingStep } from './ProcessingStep';

const CLIP_ALGORITHM_VERSION = '1.0.0';

/**
 * The result of clipping a raster to a field or zone boundary. Never
 * copies or mutates the source raster's pixel data — only records which
 * cell indices fall inside the geometry; `readClippedBandValues` reads the
 * actual values from the untouched source grid on demand. Works for both
 * field-level and zone-level clipping (Parts 11/12 of the Phase 5 brief
 * are the same operation at a different geometry).
 */
export interface FieldRasterSubset {
  id: string;
  sourceRasterId: string;
  fieldId: string;
  zoneId: string | null;
  geometry: Polygon | MultiPolygon;
  crs: 'EPSG:4326';
  cellIndices: Array<{ row: number; col: number }>;
  processingStep: ProcessingStep;
}

export function clipRasterToGeometry(params: {
  grid: RasterGrid;
  geometry: Polygon;
  fieldId: string;
  zoneId?: string | null;
}): FieldRasterSubset {
  const { grid, geometry, fieldId } = params;
  const cellIndices: Array<{ row: number; col: number }> = [];

  for (let row = 0; row < grid.metadata.heightPx; row++) {
    for (let col = 0; col < grid.metadata.widthPx; col++) {
      const { lat, lon } = grid.cellCenterLonLat(row, col);
      if (isPointInPolygon({ lat, lon }, geometry)) {
        cellIndices.push({ row, col });
      }
    }
  }

  return {
    id: createId('field_raster_subset'),
    sourceRasterId: grid.metadata.id,
    fieldId,
    zoneId: params.zoneId ?? null,
    geometry,
    crs: 'EPSG:4326',
    cellIndices,
    processingStep: recordProcessingStep({
      operation: params.zoneId ? 'zone_clip' : 'field_clip',
      algorithmVersion: CLIP_ALGORITHM_VERSION,
      parentIds: [grid.metadata.id],
      parameters: { cellCount: cellIndices.length }
    })
  };
}

/** Reads one band's values for a clipped subset from the (untouched) source grid — nodata cells are already excluded by RasterGrid.getCell. */
export function readClippedBandValues(grid: RasterGrid, subset: FieldRasterSubset, bandName: string): number[] {
  const values: number[] = [];
  for (const { row, col } of subset.cellIndices) {
    const value = grid.getCell(bandName, row, col);
    if (value !== null) values.push(value);
  }
  return values;
}
