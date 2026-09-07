/**
 * DEMO ONLY — converts the simulation's local scene coordinates (meters,
 * origin at the scene's center) into a WGS84 position near a chosen anchor,
 * using a flat-earth (equirectangular) approximation.
 *
 * This is NOT survey-grade and must never be presented as a real GNSS fix:
 * it ignores ellipsoid curvature, datum precision, and anything beyond a
 * first-order local approximation. It is accurate to a few meters at most
 * within the ~100m scale of the demo field and degrades further away — fine
 * for plotting "where the simulated drone roughly is" on the demo
 * geospatial view, never fine for anything claiming real positional
 * accuracy. See domain/GeoReference.ts's `GeodeticProvenance` for how this
 * gets labeled wherever it's used.
 */

/** Meters per degree of latitude — effectively constant across the Earth's surface. */
const METERS_PER_DEGREE_LATITUDE = 111_320;

export function simulationLocalToDemoGeodetic(
  anchor: { lat: number; lon: number },
  local: { x: number; z: number }
): { lat: number; lon: number } {
  const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos((anchor.lat * Math.PI) / 180);
  return {
    lat: anchor.lat + local.z / METERS_PER_DEGREE_LATITUDE,
    lon: anchor.lon + local.x / metersPerDegreeLongitude
  };
}

/** Inverse of simulationLocalToDemoGeodetic — same DEMO_ONLY accuracy caveats apply. Only valid for geometry actually anchored at `anchor` in the simulated scene. */
export function demoGeodeticToSimulationLocal(anchor: { lat: number; lon: number }, geo: { lat: number; lon: number }): { x: number; z: number } {
  const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos((anchor.lat * Math.PI) / 180);
  return {
    x: (geo.lon - anchor.lon) * metersPerDegreeLongitude,
    z: (geo.lat - anchor.lat) * METERS_PER_DEGREE_LATITUDE
  };
}
