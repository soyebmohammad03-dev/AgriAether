import { createId } from '../domain/id';
import type { AgriculturalMissionPlan } from '../mission/AgriculturalMission';

export type DroneAvailabilityStatus = 'AVAILABLE' | 'ON_MISSION' | 'CHARGING' | 'OFFLINE';

export interface FleetDrone {
  id: string;
  name: string;
  /** Sensor kinds this drone carries — the same vocabulary as SensorRecord.kind, so a mission's requiredSensorKinds compares directly. */
  capabilities: readonly string[];
  provenance: 'SIMULATED' | 'REAL';
  status: DroneAvailabilityStatus;
  currentMissionId: string | null;
  batteryStateOfCharge: number | null;
  lastTelemetryAt: number | null;
}

export function createFleetDrone(params: {
  name: string;
  capabilities: readonly string[];
  provenance: 'SIMULATED' | 'REAL';
  status?: DroneAvailabilityStatus;
  batteryStateOfCharge?: number | null;
}): FleetDrone {
  return {
    id: createId('drone'),
    name: params.name,
    capabilities: params.capabilities,
    provenance: params.provenance,
    status: params.status ?? 'AVAILABLE',
    currentMissionId: null,
    batteryStateOfCharge: params.batteryStateOfCharge ?? null,
    lastTelemetryAt: null
  };
}

export type AssignmentFailureReason = 'NO_AVAILABLE_DRONE' | 'NO_CAPABLE_DRONE' | 'MISSION_NOT_EXECUTABLE';

export interface AssignmentResult {
  assignedDroneId: string | null;
  reason: AssignmentFailureReason | null;
  candidatesConsidered: number;
}

/** Below this state of charge a drone is not considered for a new assignment — a documented conservative floor, not a flight-time model. */
const MIN_BATTERY_FOR_ASSIGNMENT = 20;

/**
 * Deterministic capability-matched assignment: the first AVAILABLE drone
 * (fleet order, no scoring/optimization) whose capabilities are a superset
 * of the mission plan's requiredSensorKinds and whose battery (when known)
 * is above the floor. A drone already ON_MISSION/CHARGING/OFFLINE is never
 * considered — this is also the conflict check: no drone can be assigned
 * twice. A mission with no executable waypoint path is never assigned to
 * anyone, regardless of drone availability.
 */
export function assignMission(params: { drones: readonly FleetDrone[]; plan: AgriculturalMissionPlan }): AssignmentResult {
  if (!params.plan.mission) {
    return { assignedDroneId: null, reason: 'MISSION_NOT_EXECUTABLE', candidatesConsidered: 0 };
  }

  const available = params.drones.filter((d) => d.status === 'AVAILABLE' && (d.batteryStateOfCharge === null || d.batteryStateOfCharge >= MIN_BATTERY_FOR_ASSIGNMENT));
  if (available.length === 0) {
    return { assignedDroneId: null, reason: 'NO_AVAILABLE_DRONE', candidatesConsidered: 0 };
  }

  const capable = available.find((d) => params.plan.requiredSensorKinds.every((k) => d.capabilities.includes(k)));
  if (!capable) {
    return { assignedDroneId: null, reason: 'NO_CAPABLE_DRONE', candidatesConsidered: available.length };
  }

  return { assignedDroneId: capable.id, reason: null, candidatesConsidered: available.length };
}
