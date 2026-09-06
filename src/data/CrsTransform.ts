import type { Crs } from '../domain/GeoReference';

/**
 * Three purposes a CRS can serve, kept distinct per Part 6 of the Phase 5
 * brief: the CRS data arrives in (SOURCE), the CRS it's shown in (DISPLAY),
 * and the CRS spatial math is actually performed in (ANALYSIS). This
 * codebase only implements WGS84 (EPSG:4326) today — see
 * domain/GeoReference.ts's documentation for why a projected CRS hasn't
 * been added — so all three currently resolve to the same value. The
 * distinction exists so that changes later (e.g. adding a per-farm UTM zone
 * for ANALYSIS) touch one seam instead of scattering an assumption
 * everywhere "the CRS" is used.
 */
export interface CrsContext {
  source: Crs;
  display: Crs;
  analysis: Crs;
  /** How area/distance calculations are actually performed given `analysis`. */
  analysisMethod: string;
}

export const CURRENT_CRS_CONTEXT: CrsContext = {
  source: 'EPSG:4326',
  display: 'EPSG:4326',
  analysis: 'EPSG:4326',
  analysisMethod: 'spherical (Turf.js great-circle/geodesic math) — no projection applied'
};

/**
 * A record of a coordinate transformation actually performed — e.g.
 * converting a raster's local row/column grid into geodetic coordinates.
 * Never discarded: any function that reprojects or regrids a geometry
 * should return one of these alongside its result, not silently drop the
 * source CRS.
 */
export interface CrsTransformRecord {
  sourceCrs: Crs;
  targetCrs: Crs;
  method: string;
  transformedAt: number;
}

export function recordCrsTransform(sourceCrs: Crs, targetCrs: Crs, method: string): CrsTransformRecord {
  return { sourceCrs, targetCrs, method, transformedAt: Date.now() };
}
