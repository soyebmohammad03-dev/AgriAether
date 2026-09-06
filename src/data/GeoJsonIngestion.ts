import type { Polygon, MultiPolygon } from 'geojson';
import { assertValidLatLon, areaHectares, boundingBox, findSelfIntersections } from '../geo/geometry';

export type GeometryRepairMethod = 'NONE' | 'CLOSED_RING';

export interface FieldBoundaryIngestionResult {
  status: 'VALID' | 'INVALID' | 'REPAIRED';
  /** null when INVALID — an invalid geometry is never silently used downstream. */
  geometry: Polygon | MultiPolygon | null;
  originalGeometry: Polygon | MultiPolygon;
  repairMethod: GeometryRepairMethod;
  areaHectares: number | null;
  boundingBox: [number, number, number, number] | null;
  crs: 'EPSG:4326';
  issues: string[];
}

function closeRingIfNeeded(ring: number[][]): { ring: number[][]; repaired: boolean } {
  if (ring.length === 0) return { ring, repaired: false };
  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];
  if (firstLon === lastLon && firstLat === lastLat) return { ring, repaired: false };
  return { ring: [...ring, [firstLon, firstLat]], repaired: true };
}

function validateRings(rings: number[][][], issues: string[]): { rings: number[][][]; repaired: boolean } {
  let repaired = false;
  const outRings = rings.map((ring) => {
    if (ring.length < 3) {
      issues.push(`Ring has only ${ring.length} position(s) — a polygon ring needs at least 3 distinct points.`);
      return ring;
    }
    const { ring: closed, repaired: didRepair } = closeRingIfNeeded(ring);
    if (didRepair) repaired = true;
    for (const [lon, lat] of closed) {
      try {
        assertValidLatLon(lat, lon);
      } catch (error) {
        issues.push((error as Error).message);
      }
    }
    return closed;
  });
  return { rings: outRings, repaired };
}

/**
 * Validates (and, only for a closeable ring, repairs) a field/zone boundary
 * geometry. Never silently "fixes" a geometry without recording that a
 * repair happened — `repairMethod` and `status: 'REPAIRED'` always say so.
 * A geometry with any unrecoverable issue (too few points, out-of-range
 * coordinates) comes back `status: 'INVALID'` with `geometry: null` — it is
 * never used downstream, and the caller must not treat it as ingested.
 */
export function ingestFieldBoundaryGeoJson(raw: Polygon | MultiPolygon): FieldBoundaryIngestionResult {
  const issues: string[] = [];
  const originalGeometry = raw;

  if (raw.type !== 'Polygon' && raw.type !== 'MultiPolygon') {
    return {
      status: 'INVALID',
      geometry: null,
      originalGeometry,
      repairMethod: 'NONE',
      areaHectares: null,
      boundingBox: null,
      crs: 'EPSG:4326',
      issues: [`Unsupported geometry type "${(raw as { type: string }).type}" — only Polygon and MultiPolygon are supported.`]
    };
  }

  let repaired = false;
  let geometry: Polygon | MultiPolygon;
  if (raw.type === 'Polygon') {
    const result = validateRings(raw.coordinates, issues);
    repaired = result.repaired;
    geometry = { type: 'Polygon', coordinates: result.rings };
  } else {
    const polygons = raw.coordinates.map((rings) => validateRings(rings, issues));
    repaired = polygons.some((p) => p.repaired);
    geometry = { type: 'MultiPolygon', coordinates: polygons.map((p) => p.rings) };
  }

  if (issues.length > 0) {
    return {
      status: 'INVALID',
      geometry: null,
      originalGeometry,
      repairMethod: 'NONE',
      areaHectares: null,
      boundingBox: null,
      crs: 'EPSG:4326',
      issues
    };
  }

  if (geometry.type === 'Polygon') {
    const intersections = findSelfIntersections(geometry);
    if (intersections.length > 0) {
      issues.push(`Polygon is self-intersecting at ${intersections.length} point(s) — not a simple polygon.`);
      return {
        status: 'INVALID',
        geometry: null,
        originalGeometry,
        repairMethod: 'NONE',
        areaHectares: null,
        boundingBox: null,
        crs: 'EPSG:4326',
        issues
      };
    }
  }

  return {
    status: repaired ? 'REPAIRED' : 'VALID',
    geometry,
    originalGeometry,
    repairMethod: repaired ? 'CLOSED_RING' : 'NONE',
    areaHectares: areaHectares(geometry),
    boundingBox: boundingBox(geometry),
    crs: 'EPSG:4326',
    issues
  };
}
