import { describe, expect, it } from 'vitest';
import { buildAgriculturalRasterFixture, FIXTURE_NODATA_CELL, FIXTURE_NODATA_VALUE } from './fixtures/AgriculturalRasterFixture';
import { RasterGrid, readWindow } from './Raster';

describe('RasterGrid (fixture)', () => {
  it('returns null, never the raw sentinel, for a nodata cell', () => {
    const grid = buildAgriculturalRasterFixture();
    const value = grid.getCell('RED', FIXTURE_NODATA_CELL.row, FIXTURE_NODATA_CELL.col);
    expect(value).toBeNull();
    expect(value).not.toBe(FIXTURE_NODATA_VALUE);
  });

  it('returns the known predictable value for a non-nodata cell', () => {
    const grid = buildAgriculturalRasterFixture();
    const value = grid.getCell('RED', 3, 3); // index 15 of 16, last cell
    expect(value).toBeCloseTo(0.05 + 0.3 * (15 / 16), 10);
  });

  it('returns null for an out-of-range cell rather than throwing', () => {
    const grid = buildAgriculturalRasterFixture();
    expect(grid.getCell('RED', 99, 99)).toBeNull();
  });

  it('rejects mismatched band data length at construction', () => {
    const { metadata } = buildAgriculturalRasterFixture();
    expect(() => new RasterGrid(metadata, new Map([['RED', new Float64Array(2)], ['NIR', new Float64Array(16)]]))).toThrow(/expected 16/);
  });

  it('rejects construction missing a declared band entirely', () => {
    const { metadata } = buildAgriculturalRasterFixture();
    expect(() => new RasterGrid(metadata, new Map([['RED', new Float64Array(16)]]))).toThrow(/missing data for declared band "NIR"/);
  });

  it('cellCenterLonLat stays within the raster extent', () => {
    const grid = buildAgriculturalRasterFixture();
    const { lat, lon } = grid.cellCenterLonLat(0, 0);
    const [minLon, minLat, maxLon, maxLat] = grid.metadata.extent;
    expect(lon).toBeGreaterThan(minLon);
    expect(lon).toBeLessThan(maxLon);
    expect(lat).toBeGreaterThan(minLat);
    expect(lat).toBeLessThan(maxLat);
  });

  it('readWindow excludes nodata cells from the returned values', () => {
    const grid = buildAgriculturalRasterFixture();
    const values = readWindow(grid, 'RED', { rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 4 });
    expect(values.length).toBe(3); // row 0 has 4 cells, one (0,0) is nodata
  });
});
