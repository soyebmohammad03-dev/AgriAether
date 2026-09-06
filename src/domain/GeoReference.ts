/**
 * How a Farm/Field/Zone's location is known. This is the seam between the
 * simulation's local scene coordinates and any future real-world CRS —
 * Phase 2 never invents a geodetic position for demo data, so only the
 * first two variants exist so far. A real `{ kind: 'geodetic', crs, boundary }`
 * variant belongs to the geospatial phase in the roadmap, not here.
 */
export type GeoReference =
  | { kind: 'simulation' } // exists only inside the simulated scene, no real-world referent
  | { kind: 'unknown' }; // genuinely not established yet
