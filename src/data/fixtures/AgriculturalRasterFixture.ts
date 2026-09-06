import { createRasterMetadata, RasterGrid } from '../Raster';
import { DEMO_FIELD_ANCHOR } from '../../geo/demoGeometry';

/**
 * A small, deterministic 4x4 two-band (RED, NIR) raster fixture for tests —
 * mathematically predictable values, one known nodata cell, a known CRS
 * and extent. Never used by the live application; only by the test suite,
 * to verify clipping, statistics, nodata handling, and index calculations
 * against known-correct answers rather than eyeballing real imagery.
 *
 * Values follow `value = (row * WIDTH + col) / (WIDTH * HEIGHT)` scaled per
 * band into a plausible reflectance range — an arbitrary, documented
 * formula, not a real spectral measurement of anything.
 */
const WIDTH = 4;
const HEIGHT = 4;
export const FIXTURE_NODATA_VALUE = -9999;
/** Row 0, col 0 is deliberately nodata in every band. */
export const FIXTURE_NODATA_CELL = { row: 0, col: 0 };

const HALF_WIDTH_DEG = 0.0005;
export const FIXTURE_EXTENT: [number, number, number, number] = [
  DEMO_FIELD_ANCHOR.lon - HALF_WIDTH_DEG,
  DEMO_FIELD_ANCHOR.lat - HALF_WIDTH_DEG,
  DEMO_FIELD_ANCHOR.lon + HALF_WIDTH_DEG,
  DEMO_FIELD_ANCHOR.lat + HALF_WIDTH_DEG
];

function bandValues(scale: number, offset: number): Float64Array {
  const data = new Float64Array(WIDTH * HEIGHT);
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const index = row * WIDTH + col;
      data[index] = row === FIXTURE_NODATA_CELL.row && col === FIXTURE_NODATA_CELL.col ? FIXTURE_NODATA_VALUE : offset + scale * (index / (WIDTH * HEIGHT));
    }
  }
  return data;
}

export function buildAgriculturalRasterFixture(): RasterGrid {
  const metadata = createRasterMetadata({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    extent: FIXTURE_EXTENT,
    bands: [
      { name: 'RED', index: 0, unit: 'reflectance', wavelengthNm: 660 },
      { name: 'NIR', index: 1, unit: 'reflectance', wavelengthNm: 840 }
    ],
    nodataValue: FIXTURE_NODATA_VALUE,
    dtype: 'float32',
    acquiredAt: Date.UTC(2026, 3, 1), // 2026-04-01 — an arbitrary fixed fixture date, never "now"
    source: 'fixture:agricultural-raster-fixture'
  });

  const bandData = new Map<string, Float64Array>([
    ['RED', bandValues(0.3, 0.05)],
    ['NIR', bandValues(0.5, 0.1)]
  ]);

  return new RasterGrid(metadata, bandData);
}
