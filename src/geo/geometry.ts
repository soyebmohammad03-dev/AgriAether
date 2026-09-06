import { point, polygon as turfPolygon } from '@turf/helpers';
import turfDistance from '@turf/distance';
import turfBooleanPointInPolygon from '@turf/boolean-point-in-polygon';
import turfBbox from '@turf/bbox';
import turfArea from '@turf/area';
import type { Polygon, MultiPolygon } from 'geojson';

/**
 * A small geospatial utility layer, not a GIS engine — every function here
 * wraps a single well-tested Turf.js primitive rather than reimplementing
 * spherical geometry by hand. Add a function only when something in this
 * codebase actually calls it.
 */

export function assertValidLatLon(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat} (must be between -90 and 90)`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error(`Invalid longitude: ${lon} (must be between -180 and 180)`);
  }
}

/** Great-circle distance between two WGS84 points, in meters. */
export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  assertValidLatLon(a.lat, a.lon);
  assertValidLatLon(b.lat, b.lon);
  return turfDistance(point([a.lon, a.lat]), point([b.lon, b.lat]), { units: 'meters' });
}

/** Whether a WGS84 point falls inside a polygon (ring in [lon, lat] pairs, GeoJSON order). */
export function isPointInPolygon(p: { lat: number; lon: number }, polygon: Polygon): boolean {
  assertValidLatLon(p.lat, p.lon);
  return turfBooleanPointInPolygon(point([p.lon, p.lat]), turfPolygon(polygon.coordinates));
}

/** [minLon, minLat, maxLon, maxLat] bounding box of a polygon/multipolygon. */
export function boundingBox(geometry: Polygon | MultiPolygon): [number, number, number, number] {
  return turfBbox(geometry) as [number, number, number, number];
}

/** Area of a polygon/multipolygon in hectares (Turf returns m²; 1 ha = 10,000 m²). */
export function areaHectares(geometry: Polygon | MultiPolygon): number {
  return turfArea(geometry) / 10_000;
}

/** A ring must have at least 4 positions and be closed (first === last) — GeoJSON's own requirement, checked explicitly rather than trusting the caller. */
export function assertValidPolygon(polygon: Polygon): void {
  for (const ring of polygon.coordinates) {
    if (ring.length < 4) {
      throw new Error(`Polygon ring has ${ring.length} positions, GeoJSON requires at least 4 (closed ring)`);
    }
    const [firstLon, firstLat] = ring[0];
    const [lastLon, lastLat] = ring[ring.length - 1];
    if (firstLon !== lastLon || firstLat !== lastLat) {
      throw new Error('Polygon ring is not closed — first and last positions must match');
    }
    for (const [lon, lat] of ring) {
      assertValidLatLon(lat, lon);
    }
  }
}
