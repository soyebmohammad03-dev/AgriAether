import type { Polygon } from 'geojson';
import type { GeoReference } from '../domain/GeoReference';
import { boundingBox, isPointInPolygon, areaHectares } from '../geo/geometry';
import { demoGeodeticToSimulationLocal } from '../geo/georeference';
import { DEMO_FIELD_ANCHOR } from '../geo/demoGeometry';
import { createWaypoint, createMission, type Mission } from './Mission';
import { createId } from '../domain/id';

export type MissionObjective = 'FIELD_SURVEY' | 'VEGETATION_SURVEY' | 'SOIL_SAMPLING' | 'WEATHER_SURVEY' | 'TARGETED_INSPECTION';

/** Sensor kinds an objective requires — reused by autonomy/fleet capability checks, not just display. */
export const OBJECTIVE_SENSOR_REQUIREMENTS: Record<MissionObjective, string[]> = {
  FIELD_SURVEY: ['rgb-camera'],
  VEGETATION_SURVEY: ['multispectral-camera'],
  SOIL_SAMPLING: ['soil-moisture', 'soil-ec', 'soil-ph'],
  WEATHER_SURVEY: ['weather-station'],
  TARGETED_INSPECTION: ['rgb-camera']
};

/** Generic, widely-cited recreational/commercial altitude ceiling (e.g. US Part 107) — not validated against any specific real airspace authority; see limitations for how this is disclosed. */
const DEFAULT_ALTITUDE_M = 30;
const MAX_ALTITUDE_M = 120;
const DEFAULT_SPEED_MS = 4;
const GRID_SPACING_M = 20;

export interface AgriculturalMissionPlan {
  id: string;
  mission: Mission | null;
  fieldId: string;
  zoneId: string | null;
  objective: MissionObjective;
  requiredSensorKinds: string[];
  altitudeM: number;
  speedTarget: number;
  estimatedCoverageHectares: number | null;
  limitations: string[];
  provenance: 'PLANNED_FROM_DEMO_GEOMETRY' | 'UNAVAILABLE';
  createdAt: number;
}

/** Lawnmower-pattern waypoints clipped to the polygon via bbox + point-in-polygon — no waypoint outside the field boundary. */
function generateGridWaypoints(polygon: Polygon, spacingM: number, altitudeM: number, speedTarget: number): ReturnType<typeof createWaypoint>[] {
  const [minLon, minLat, maxLon, maxLat] = boundingBox(polygon);
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const latStep = spacingM / metersPerDegreeLat;
  const lonStep = spacingM / metersPerDegreeLon;

  const waypoints: ReturnType<typeof createWaypoint>[] = [];
  let row = 0;
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    const lonRange: number[] = [];
    for (let lon = minLon; lon <= maxLon; lon += lonStep) lonRange.push(lon);
    const ordered = row % 2 === 0 ? lonRange : [...lonRange].reverse();
    for (const lon of ordered) {
      if (!isPointInPolygon({ lat, lon }, polygon)) continue;
      const local = demoGeodeticToSimulationLocal(DEMO_FIELD_ANCHOR, { lat, lon });
      waypoints.push(
        createWaypoint({
          id: createId('waypoint'),
          position: { x: local.x, y: altitudeM, z: local.z },
          geoPosition: { crs: 'EPSG:4326', lat, lon },
          altitude: altitudeM,
          speedTarget,
          action: 'scan'
        })
      );
    }
    row += 1;
  }
  return waypoints;
}

/**
 * Plans an agricultural mission against a field's actual geometry. Real
 * waypoints (with both simulation-local and geodetic position) are only
 * ever generated for the DEMO_ONLY field boundary this repository actually
 * has, because that's the only geometry with a known mapping into the
 * simulated scene — see geo/georeference.ts. Any other provenance
 * (SURVEYED/USER_DRAWN/EXTERNAL) or missing/non-polygon geometry returns
 * `mission: null` with an explicit limitation instead of inventing GPS
 * coordinates or a fabricated local frame.
 */
export function planAgriculturalMission(params: {
  fieldId: string;
  zoneId?: string | null;
  objective: MissionObjective;
  geoReference: GeoReference;
  altitudeM?: number;
  speedTarget?: number;
}): AgriculturalMissionPlan {
  const altitudeM = params.altitudeM ?? DEFAULT_ALTITUDE_M;
  const speedTarget = params.speedTarget ?? DEFAULT_SPEED_MS;
  const requiredSensorKinds = OBJECTIVE_SENSOR_REQUIREMENTS[params.objective];
  const limitations: string[] = [];

  if (altitudeM <= 0 || altitudeM > MAX_ALTITUDE_M) {
    limitations.push(`Requested altitude ${altitudeM}m is outside the safe default envelope (0, ${MAX_ALTITUDE_M}]m — a generic ceiling, not validated against any specific real airspace authority.`);
  }
  if (speedTarget <= 0) {
    limitations.push(`Requested speed ${speedTarget}m/s is not positive.`);
  }

  const geo = params.geoReference;
  if (geo.kind !== 'geodetic' || geo.geometry.type !== 'Polygon') {
    limitations.push('No real field boundary polygon is available for this field — cannot generate waypoints. This plan carries no GPS coordinates.');
    return {
      id: createId('mission_plan'),
      mission: null,
      fieldId: params.fieldId,
      zoneId: params.zoneId ?? null,
      objective: params.objective,
      requiredSensorKinds,
      altitudeM,
      speedTarget,
      estimatedCoverageHectares: null,
      limitations,
      provenance: 'UNAVAILABLE',
      createdAt: Date.now()
    };
  }

  const polygon = geo.geometry;
  const estimatedCoverageHectares = areaHectares(polygon);

  if (geo.provenance !== 'DEMO_ONLY') {
    limitations.push(`Field geometry provenance is ${geo.provenance}, not DEMO_ONLY — no simulation-local coordinate mapping exists for it yet, so no waypoint path can be generated.`);
    return {
      id: createId('mission_plan'),
      mission: null,
      fieldId: params.fieldId,
      zoneId: params.zoneId ?? null,
      objective: params.objective,
      requiredSensorKinds,
      altitudeM,
      speedTarget,
      estimatedCoverageHectares,
      limitations,
      provenance: 'UNAVAILABLE',
      createdAt: Date.now()
    };
  }

  if (limitations.length > 0) {
    return {
      id: createId('mission_plan'),
      mission: null,
      fieldId: params.fieldId,
      zoneId: params.zoneId ?? null,
      objective: params.objective,
      requiredSensorKinds,
      altitudeM,
      speedTarget,
      estimatedCoverageHectares,
      limitations,
      provenance: 'UNAVAILABLE',
      createdAt: Date.now()
    };
  }

  const waypoints = generateGridWaypoints(polygon, GRID_SPACING_M, altitudeM, speedTarget);
  if (waypoints.length < 2) {
    limitations.push('Field boundary is too small relative to the default grid spacing to produce a coverage path.');
  }

  return {
    id: createId('mission_plan'),
    mission: waypoints.length >= 2 ? createMission({ id: createId('mission'), name: `${params.objective} — field ${params.fieldId}`, waypoints, loop: false }) : null,
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    objective: params.objective,
    requiredSensorKinds,
    altitudeM,
    speedTarget,
    estimatedCoverageHectares,
    limitations,
    provenance: waypoints.length >= 2 ? 'PLANNED_FROM_DEMO_GEOMETRY' : 'UNAVAILABLE',
    createdAt: Date.now()
  };
}
