/**
 * A Mission is the drone's plan, owned independently of both the renderer
 * (which only visualizes it) and the simulation engine (which only executes
 * it). Phase 1 ships exactly one hardcoded survey-loop mission — see
 * defaultMission.ts — but the shape here is meant to outlive that.
 */

export interface Waypoint {
  id: string;
  /** Simulation-local meters. */
  position: { x: number; y: number; z: number };
  /**
   * Real-world position, when one is known. Phase 3 establishes this field
   * but leaves it null for the existing hardcoded mission — the mission is
   * built before any Field's geodetic anchor exists, and computing this
   * would mean guessing. A mission authored against a real or demo field
   * boundary is what would actually populate it (later phase).
   */
  geoPosition: { crs: 'EPSG:4326'; lat: number; lon: number } | null;
  /** Meters above ground level the drone should hold near this waypoint. */
  altitude: number;
  /** Target ground speed approaching this waypoint, m/s. */
  speedTarget: number;
  action: 'none' | 'hover' | 'scan';
}

export type MissionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABORTED';

export interface Mission {
  id: string;
  name: string;
  waypoints: Waypoint[];
  /** Whether the path loops back to the first waypoint after the last. */
  loop: boolean;
  status: MissionStatus;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export function createWaypoint(params: {
  id: string;
  position: { x: number; y: number; z: number };
  geoPosition?: { crs: 'EPSG:4326'; lat: number; lon: number } | null;
  altitude: number;
  speedTarget: number;
  action?: Waypoint['action'];
}): Waypoint {
  if (params.altitude < 0) {
    throw new Error(`Waypoint "${params.id}" has a negative altitude (${params.altitude}m)`);
  }
  if (params.speedTarget <= 0) {
    throw new Error(`Waypoint "${params.id}" has a non-positive speed target (${params.speedTarget}m/s)`);
  }
  return {
    id: params.id,
    position: params.position,
    geoPosition: params.geoPosition ?? null,
    altitude: params.altitude,
    speedTarget: params.speedTarget,
    action: params.action ?? 'none'
  };
}

export function createMission(params: {
  id: string;
  name: string;
  waypoints: Waypoint[];
  loop?: boolean;
}): Mission {
  if (params.waypoints.length < 2) {
    throw new Error(`Mission "${params.id}" needs at least 2 waypoints, got ${params.waypoints.length}`);
  }
  return {
    id: params.id,
    name: params.name,
    waypoints: params.waypoints,
    loop: params.loop ?? true,
    status: 'PENDING',
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null
  };
}
