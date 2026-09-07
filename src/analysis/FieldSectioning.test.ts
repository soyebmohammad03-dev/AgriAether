import { describe, expect, it } from 'vitest';
import { generateFieldSections, type ZoneCellFeature } from './FieldSectioning';
import { createRasterMetadata, RasterGrid } from '../data/Raster';

/** A 6x6 grid, two clearly separated NDVI plateaus (low-left block, high-right block) plus a handful of scattered single "noise" cells that should be filtered by minRegionCells. */
function buildTestGrid(): RasterGrid {
  const metadata = createRasterMetadata({
    widthPx: 6,
    heightPx: 6,
    extent: [-93.001, 42.001, -93.0, 42.002],
    bands: [{ name: 'RED', index: 0, unit: 'reflectance', wavelengthNm: 660 }],
    nodataValue: -9999,
    dtype: 'float32',
    acquiredAt: Date.UTC(2026, 0, 1),
    source: 'test-fixture'
  });
  const data = new Float64Array(36).fill(0.2);
  return new RasterGrid(metadata, new Map([['RED', data]]));
}

function makeCells(): ZoneCellFeature[] {
  const cells: ZoneCellFeature[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const value = col < 3 ? 0.2 : 0.8; // left block low NDVI, right block high NDVI
      cells.push({ row, col, value });
    }
  }
  // One isolated noise cell, spatially disconnected from the rest of the grid — should form its own tiny region and be filtered.
  cells.push({ row: 10, col: 10, value: 0.99 });
  return cells;
}

describe('generateFieldSections', () => {
  it('is deterministic — identical input produces identical zone count/cell composition across repeated calls', () => {
    const grid = buildTestGrid();
    const cells = makeCells();
    const a = generateFieldSections({ fieldId: 'f1', grid, ndviCells: cells, sourceObservationIds: ['obs_1'], sourceDatasetIds: ['ds_1'], k: 2, minRegionCells: 3 });
    const b = generateFieldSections({ fieldId: 'f1', grid, ndviCells: cells, sourceObservationIds: ['obs_1'], sourceDatasetIds: ['ds_1'], k: 2, minRegionCells: 3 });
    expect(a.zones.length).toBe(b.zones.length);
    expect(a.generationRecords.map((r) => r.cellCount)).toEqual(b.generationRecords.map((r) => r.cellCount));
  });

  it('separates two clearly distinct NDVI regions into two zones', () => {
    const grid = buildTestGrid();
    const cells = makeCells();
    const result = generateFieldSections({ fieldId: 'f1', grid, ndviCells: cells, sourceObservationIds: [], sourceDatasetIds: [], k: 2, minRegionCells: 3 });
    expect(result.zones.length).toBe(2);
    for (const zone of result.zones) {
      expect(zone.classification).toBe('GIS_DERIVED');
      expect(zone.fieldId).toBe('f1');
    }
  });

  it('records real generation provenance — method, parameters, feature names, source ids, never fabricated', () => {
    const grid = buildTestGrid();
    const cells = makeCells();
    const result = generateFieldSections({ fieldId: 'f1', grid, ndviCells: cells, sourceObservationIds: ['obs_ndvi_1'], sourceDatasetIds: ['dataset_1'], k: 2, minRegionCells: 3 });
    for (const record of result.generationRecords) {
      expect(record.method).toBe('kmeans_ndvi_connected_components');
      expect(record.featureNames).toEqual(['NDVI']);
      expect(record.sourceObservationIds).toEqual(['obs_ndvi_1']);
      expect(record.sourceDatasetIds).toEqual(['dataset_1']);
      expect(record.meanNdvi).not.toBeNull();
      expect(record.areaHectares).toBeGreaterThan(0);
    }
  });

  it('filters a tiny noise region below minRegionCells rather than forcing it into a neighboring zone', () => {
    const grid = buildTestGrid();
    const cells = makeCells();
    const result = generateFieldSections({ fieldId: 'f1', grid, ndviCells: cells, sourceObservationIds: [], sourceDatasetIds: [], k: 2, minRegionCells: 3 });
    expect(result.unassignedCellCount).toBeGreaterThan(0);
    const assignedCells = result.generationRecords.reduce((sum, r) => sum + r.cellCount, 0);
    expect(assignedCells + result.unassignedCellCount).toBe(result.totalCellCount);
  });

  it('returns no zones for an empty evidence set, never a fabricated zone', () => {
    const grid = buildTestGrid();
    const result = generateFieldSections({ fieldId: 'f1', grid, ndviCells: [], sourceObservationIds: [], sourceDatasetIds: [] });
    expect(result.zones).toEqual([]);
    expect(result.totalCellCount).toBe(0);
  });
});
