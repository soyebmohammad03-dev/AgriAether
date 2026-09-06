import type { Polygon } from 'geojson';
import { assertValidPolygon } from './geometry';

/**
 * Null Island (0°N, 0°E) — the well-known GIS convention for "not a real
 * place." Used deliberately as the demo field's anchor instead of any real
 * or recognizable coordinate, so nobody could mistake this fixture for an
 * actual farm location. See domain/GeoReference.ts.
 */
export const DEMO_FIELD_ANCHOR = { lat: 0, lon: 0 };

const HALF_WIDTH_DEG = 0.001; // ~111m at the equator

/** A small square demo boundary centered on the anchor — DEMO_ONLY, not a real survey. */
export function buildDemoFieldBoundary(): Polygon {
  const { lat, lon } = DEMO_FIELD_ANCHOR;
  const polygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [lon - HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG],
        [lon + HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG],
        [lon + HALF_WIDTH_DEG, lat + HALF_WIDTH_DEG],
        [lon - HALF_WIDTH_DEG, lat + HALF_WIDTH_DEG],
        [lon - HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG]
      ]
    ]
  };
  assertValidPolygon(polygon);
  return polygon;
}

/** The west and east halves of the demo field boundary — DEMO_ONLY sub-zones, not derived from any real soil/imagery analysis. */
export function buildDemoZoneBoundaries(): { zoneA: Polygon; zoneB: Polygon } {
  const { lat, lon } = DEMO_FIELD_ANCHOR;
  const zoneA: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [lon - HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG],
        [lon, lat - HALF_WIDTH_DEG],
        [lon, lat + HALF_WIDTH_DEG],
        [lon - HALF_WIDTH_DEG, lat + HALF_WIDTH_DEG],
        [lon - HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG]
      ]
    ]
  };
  const zoneB: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [lon, lat - HALF_WIDTH_DEG],
        [lon + HALF_WIDTH_DEG, lat - HALF_WIDTH_DEG],
        [lon + HALF_WIDTH_DEG, lat + HALF_WIDTH_DEG],
        [lon, lat + HALF_WIDTH_DEG],
        [lon, lat - HALF_WIDTH_DEG]
      ]
    ]
  };
  assertValidPolygon(zoneA);
  assertValidPolygon(zoneB);
  return { zoneA, zoneB };
}
