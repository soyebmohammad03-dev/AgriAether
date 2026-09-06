import type { FlightState } from './FlightStateMachine';

/**
 * The drone's full kinematic + operational state for one simulation tick.
 * Units are documented per-field because unit confusion is exactly the kind
 * of silent error this rewrite exists to prevent. Every field here is either
 * a value the simulation genuinely computes, or explicitly nullable when
 * unavailable — nothing is invented to satisfy a HUD layout.
 *
 * Coordinate frame: "simulation-local", meters, right-handed, matching the
 * Three.js scene axes. This is NOT a real-world geodetic frame — see
 * sensors/SimulatedGpsSensor.ts.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrientationEuler {
  /** Degrees, nose up positive. */
  pitch: number;
  /** Degrees, right-wing-down positive. */
  roll: number;
  /** Degrees, 0-360, clockwise from +Z. */
  yaw: number;
}

export interface BatteryState {
  /** State of charge, 0-100. Always simulated in Phase 1 — see simulation/BatteryModel.ts. */
  stateOfCharge: number;
  /** Whether the simulated pack is considered critically low (triggers RTH logic upstream). */
  critical: boolean;
}

export interface MissionState {
  missionId: string | null;
  currentWaypointIndex: number | null;
  /** 0-1 fraction of waypoints reached this loop; null if no mission active. */
  progress: number | null;
}

export interface DroneState {
  /** Epoch milliseconds this state was computed for. */
  timestamp: number;
  /** Meters, simulation-local frame. */
  position: Vec3;
  /** Meters/second, simulation-local frame. */
  velocity: Vec3;
  /** Meters/second², simulation-local frame. */
  acceleration: Vec3;
  orientation: OrientationEuler;
  /** Degrees/second around the yaw axis. Pitch/roll rates are not modeled in Phase 1. */
  yawRate: number;
  /** Meters above the field plane (y=0). Derived from position.y, not an independent sensor. */
  altitudeAgl: number;
  /** Meters/second, horizontal component of velocity. */
  groundSpeed: number;
  /** Degrees, 0-360. Derived from the velocity/forward vector. */
  heading: number;
  battery: BatteryState;
  flightState: FlightState;
  mission: MissionState;
}
