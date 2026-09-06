import type { Point, Polygon, MultiPolygon } from 'geojson';

/**
 * The only real-world coordinate reference system this codebase supports.
 * WGS84 geographic (latitude/longitude in degrees) is the universal
 * interchange format for GNSS and GeoJSON. A projected/local metric CRS
 * (e.g. a per-farm UTM zone) is not implemented — Phase 3's distance/area
 * math instead uses spherical (haversine-based) calculations via Turf,
 * which are accurate enough at field scale without needing a projection.
 * Add a projected CRS only if a genuine need (e.g. planar CAD-style
 * drawing tools) appears later.
 */
export type Crs = 'EPSG:4326';

/**
 * How honestly a piece of real-world geometry was obtained. A GeoReference
 * of kind 'geodetic' always carries one of these — never silently implying
 * survey accuracy for a value that was actually invented for the demo.
 */
export type GeodeticProvenance = 'DEMO_ONLY' | 'SURVEYED' | 'USER_DRAWN' | 'EXTERNAL';

/**
 * How a Farm/Field/Zone's location is known. This is the seam between the
 * simulation's local scene coordinates and any future real-world CRS.
 *
 * 'geodetic' carries real GeoJSON geometry in WGS84 — but "real" here means
 * "expressed in a real-world coordinate system," not "surveyed": see
 * `provenance`. The seeded demo world uses `DEMO_ONLY` geometry anchored at
 * Null Island (0°N 0°E) specifically because it is a well-known GIS
 * convention for "not a real place" — never a recognizable real farm
 * location, which would misrepresent this as real survey data.
 */
export type GeoReference =
  | { kind: 'simulation' } // exists only inside the simulated scene, no real-world referent
  | { kind: 'unknown' } // genuinely not established yet
  | { kind: 'geodetic'; crs: Crs; geometry: Point | Polygon | MultiPolygon; provenance: GeodeticProvenance };
