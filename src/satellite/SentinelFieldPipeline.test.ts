import { describe, expect, it } from 'vitest';
import { analyzeFieldFromSentinelRaster } from './SentinelFieldPipeline';
import { buildAgriculturalRasterFixture, FIXTURE_EXTENT, FIXTURE_NODATA_CELL } from '../data/fixtures/AgriculturalRasterFixture';
import type { SentinelSceneSummary } from './SentinelTypes';
import type { Polygon } from 'geojson';

function extentAsPolygon(extent: [number, number, number, number]): Polygon {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return { type: 'Polygon', coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
}

function fakeScene(overrides: Partial<SentinelSceneSummary> = {}): SentinelSceneSummary {
  return {
    itemId: 'fixture_scene',
    collection: 'sentinel-2-l2a',
    selfUrl: null,
    datetime: '2024-08-31T17:08:51.024000Z',
    cloudCoverPercent: 5,
    epsg: 32615,
    processingBaseline: '05.11',
    bbox: FIXTURE_EXTENT,
    assets: {},
    ...overrides
  };
}

describe('analyzeFieldFromSentinelRaster (deterministic fixture, no live network)', () => {
  it('computes real per-pixel NDVI statistics and provenance-correct Observations from the raster fixture', () => {
    const grid = buildAgriculturalRasterFixture();
    const result = analyzeFieldFromSentinelRaster({ grid, scene: fakeScene(), fieldGeometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });

    expect(result.totalPixelCount).toBe(16);
    // One nodata cell in both bands -> excluded from valid pixel NDVI.
    expect(result.validPixelCount).toBe(15);
    expect(result.ndviStats.mean.value).not.toBeNull();
    expect(result.ndviStats.min.value).toBeLessThanOrEqual(result.ndviStats.max.value!);

    expect(result.ndviObservation).not.toBeNull();
    expect(result.ndviObservation!.provenance).toBe('ESTIMATED'); // never SIMULATED, never PREDICTED
    expect(result.ndviObservation!.fieldId).toBe('field_1');

    expect(result.rawBandObservations).toHaveLength(2);
    for (const obs of result.rawBandObservations) {
      expect(obs.provenance).toBe('EXTERNAL');
      expect(obs.source).toBe('external:sentinel-2-l2a');
    }

    expect(result.quality).toBe('VALID');
  });

  it('excludes the fixture nodata cell from NDVI computation rather than treating it as a real zero reading', () => {
    const grid = buildAgriculturalRasterFixture();
    expect(grid.getCell('RED', FIXTURE_NODATA_CELL.row, FIXTURE_NODATA_CELL.col)).toBeNull();
    expect(grid.getCell('NIR', FIXTURE_NODATA_CELL.row, FIXTURE_NODATA_CELL.col)).toBeNull();
  });

  it('flags QUESTIONABLE quality for a high-cloud-cover scene even with full pixel coverage', () => {
    const grid = buildAgriculturalRasterFixture();
    const result = analyzeFieldFromSentinelRaster({ grid, scene: fakeScene({ cloudCoverPercent: 85 }), fieldGeometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });
    expect(result.quality).toBe('QUESTIONABLE');
  });

  it('throws rather than producing an empty analysis when the field geometry does not intersect the raster', () => {
    const grid = buildAgriculturalRasterFixture();
    const farAwayPolygon: Polygon = { type: 'Polygon', coordinates: [[[50, 50], [50.001, 50], [50.001, 50.001], [50, 50.001], [50, 50]]] };
    expect(() => analyzeFieldFromSentinelRaster({ grid, scene: fakeScene(), fieldGeometry: farAwayPolygon, fieldId: 'field_1' })).toThrow(/does not intersect/);
  });
});
