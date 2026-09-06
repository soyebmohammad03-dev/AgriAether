import { describe, expect, it } from 'vitest';
import { buildAgriculturalRasterFixture, FIXTURE_EXTENT } from './fixtures/AgriculturalRasterFixture';
import { clipRasterToGeometry, readClippedBandValues } from './FieldClip';
import type { Polygon } from 'geojson';

function extentAsPolygon(extent: [number, number, number, number]): Polygon {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return { type: 'Polygon', coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
}

describe('clipRasterToGeometry', () => {
  it('clips the whole raster when the geometry covers the full extent', () => {
    const grid = buildAgriculturalRasterFixture();
    const subset = clipRasterToGeometry({ grid, geometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });
    expect(subset.cellIndices.length).toBe(16);
    expect(subset.zoneId).toBeNull();
    expect(subset.processingStep.operation).toBe('field_clip');
  });

  it('clips to fewer cells for a zone covering half the extent, and tags zoneId', () => {
    const grid = buildAgriculturalRasterFixture();
    const [minLon, minLat, maxLon, maxLat] = FIXTURE_EXTENT;
    const halfExtent: Polygon = extentAsPolygon([minLon, minLat, (minLon + maxLon) / 2, maxLat]);
    const subset = clipRasterToGeometry({ grid, geometry: halfExtent, fieldId: 'field_1', zoneId: 'zone_a' });
    expect(subset.cellIndices.length).toBeGreaterThan(0);
    expect(subset.cellIndices.length).toBeLessThan(16);
    expect(subset.zoneId).toBe('zone_a');
    expect(subset.processingStep.operation).toBe('zone_clip');
  });

  it('never mutates the source raster', () => {
    const grid = buildAgriculturalRasterFixture();
    const before = grid.getCell('RED', 1, 1);
    clipRasterToGeometry({ grid, geometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });
    expect(grid.getCell('RED', 1, 1)).toBe(before);
  });

  it('readClippedBandValues excludes the known nodata cell', () => {
    const grid = buildAgriculturalRasterFixture();
    const subset = clipRasterToGeometry({ grid, geometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });
    const values = readClippedBandValues(grid, subset, 'RED');
    expect(values.length).toBe(15); // 16 cells minus 1 nodata cell
  });
});
