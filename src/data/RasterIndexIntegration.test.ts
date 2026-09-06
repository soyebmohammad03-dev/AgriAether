import { describe, expect, it } from 'vitest';
import { buildAgriculturalRasterFixture, FIXTURE_EXTENT } from './fixtures/AgriculturalRasterFixture';
import { clipRasterToGeometry, readClippedBandValues } from './FieldClip';
import { computeSpatialStatistics } from './SpatialStatistics';
import { createMultispectralReading } from '../sensing/MultispectralReading';
import { calculateIndex } from '../sensing/IndexEngine';
import type { Polygon } from 'geojson';

function extentAsPolygon(extent: [number, number, number, number]): Polygon {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return { type: 'Polygon', coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
}

/**
 * The real path Part 25 of the Phase 5 brief calls for: a raster fixture
 * feeds field clipping, feeds spatial statistics, feeds the Phase 4
 * IndexEngine — extending vegetation-index support from a single reading
 * to real (fixture) raster data, not two disconnected systems.
 */
describe('raster -> clip -> statistics -> vegetation index (end to end)', () => {
  it('computes a real NDVI value from the fixture raster, tied back to its raster/field lineage', () => {
    const grid = buildAgriculturalRasterFixture();
    const subset = clipRasterToGeometry({ grid, geometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });

    const redValues = readClippedBandValues(grid, subset, 'RED');
    const nirValues = readClippedBandValues(grid, subset, 'NIR');
    const redMean = computeSpatialStatistics(redValues, subset.cellIndices.length, 'mean');
    const nirMean = computeSpatialStatistics(nirValues, subset.cellIndices.length, 'mean');

    expect(redMean.value).not.toBeNull();
    expect(nirMean.value).not.toBeNull();

    const reading = createMultispectralReading({
      bands: { RED: redMean.value!, NIR: nirMean.value! },
      unitKind: 'reflectance',
      capturedAt: grid.metadata.acquiredAt,
      fieldId: subset.fieldId,
      provenance: 'MEASURED' // the fixture stands in for a real, calibrated reflectance capture
    });

    const result = calculateIndex('NDVI', reading);
    expect(result.status).toBe('OK');
    expect(result.value).toBeGreaterThan(0); // NIR mean > RED mean by construction, so NDVI should be positive
    expect(result.sourceReadingId).toBe(reading.id);
  });
});
