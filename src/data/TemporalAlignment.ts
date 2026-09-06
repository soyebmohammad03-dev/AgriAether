import type { RasterMetadata } from './Raster';

export type TemporalCompatibilityStatus = 'COMPATIBLE' | 'INCOMPATIBLE_DATA' | 'INSUFFICIENT_DATA';

export interface TemporalCompatibilityResult {
  status: TemporalCompatibilityStatus;
  reasons: string[];
}

function extentsOverlapSubstantially(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  const [aMinLon, aMinLat, aMaxLon, aMaxLat] = a;
  const [bMinLon, bMinLat, bMaxLon, bMaxLat] = b;
  const overlapLon = Math.min(aMaxLon, bMaxLon) - Math.max(aMinLon, bMinLon);
  const overlapLat = Math.min(aMaxLat, bMaxLat) - Math.max(aMinLat, bMinLat);
  return overlapLon > 0 && overlapLat > 0;
}

/**
 * Before any raster-level temporal comparison runs, this checks the things
 * Part 24 of the Phase 5 brief lists: compatible spatial reference,
 * compatible band, reasonable spatial alignment, timestamps present and
 * distinct. Failing any of these returns INCOMPATIBLE_DATA (a real,
 * structural mismatch) or INSUFFICIENT_DATA (missing information) with
 * reasons — the caller must not proceed to compute a comparison.
 */
export function checkTemporalCompatibility(a: RasterMetadata, b: RasterMetadata, bandName: string): TemporalCompatibilityResult {
  const reasons: string[] = [];

  if (!Number.isFinite(a.acquiredAt) || !Number.isFinite(b.acquiredAt)) {
    reasons.push('One or both rasters have no valid acquisition timestamp.');
    return { status: 'INSUFFICIENT_DATA', reasons };
  }
  if (a.acquiredAt === b.acquiredAt) {
    reasons.push('Both rasters have the identical acquisition timestamp — nothing to compare temporally.');
    return { status: 'INSUFFICIENT_DATA', reasons };
  }
  if (a.crs !== b.crs) {
    reasons.push(`CRS mismatch: "${a.crs}" vs "${b.crs}".`);
  }
  if (!a.bands.some((band) => band.name === bandName) || !b.bands.some((band) => band.name === bandName)) {
    reasons.push(`Band "${bandName}" is not present in both rasters.`);
  }
  if (!extentsOverlapSubstantially(a.extent, b.extent)) {
    reasons.push('Raster extents do not substantially overlap — not spatially comparable.');
  }

  if (reasons.length > 0) {
    return { status: 'INCOMPATIBLE_DATA', reasons };
  }
  return { status: 'COMPATIBLE', reasons: [] };
}
