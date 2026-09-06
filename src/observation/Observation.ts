/**
 * Observation is the one shape every quantity in AgriAether flows through —
 * telemetry, sensor readings, weather, soil, crop, model output. It exists so
 * a value's origin can never be silently lost: a consumer reading an
 * Observation always knows whether it came from a real instrument, a model,
 * a human, or (as everything in Phase 1 does) the simulation engine.
 *
 * Nothing outside this module should construct an Observation with
 * `provenance: 'MEASURED'` — there is no real sensor in this codebase yet.
 */

import { createId } from '../domain/id';

export type Provenance =
  | 'MEASURED' // read directly from a calibrated physical instrument
  | 'SIMULATED' // produced by the simulation engine, no physical referent
  | 'ESTIMATED' // derived from other observations via a stated model/formula
  | 'PREDICTED' // output of a forecasting/ML model
  | 'USER_REPORTED' // entered by a person (farmer, agronomist, operator)
  | 'EXTERNAL' // sourced from a third-party API/dataset
  | 'UNKNOWN'; // provenance genuinely could not be determined

export type ObservationStatus = 'OK' | 'UNAVAILABLE' | 'INVALID';

export interface ObservationLocation {
  /** Coordinate frame this location is expressed in — never assume WGS84. */
  frame: 'simulation-local';
  /** Meters, simulation-local axes. */
  x: number;
  y: number;
  z: number;
}

/**
 * Domain context linking an Observation back into the Farm/Field/Zone/
 * Mission/Drone/Sensor world (Phase 2). All optional and independently
 * nullable — an Observation is valid on its own, and most of this context
 * is genuinely unknown for some observations (e.g. a manually-entered soil
 * sample has no missionId or droneId).
 */
export interface Observation<T = number> {
  id: string;
  /** Dot-namespaced quantity name, e.g. "drone.altitude", "drone.battery.soc". */
  type: string;
  /** null is valid and means "no value" — see status. */
  value: T | null;
  /** SI-preferred unit string, e.g. "m", "m/s", "deg", "percent". null if unitless or unavailable. */
  unit: string | null;
  /** Epoch milliseconds. Required — an Observation without one is invalid. */
  timestamp: number;
  location: ObservationLocation | null;
  /** Identifies the producer, e.g. "simulation-engine", "sim-sensor:gps". */
  source: string;
  provenance: Provenance;
  /** 0–1 confidence, or null when the provenance type has no meaningful confidence (e.g. USER_REPORTED). */
  confidence: number | null;
  status: ObservationStatus;
  /** Domain context — which farm/field/zone/sensor/mission/drone this reading belongs to, where known. */
  farmId?: string | null;
  fieldId?: string | null;
  zoneId?: string | null;
  sensorId?: string | null;
  missionId?: string | null;
  droneId?: string | null;
  /** Small bag for attributes that don't belong on every Observation (e.g. sample depth). Never scientific values disguised as metadata. */
  metadata?: Record<string, string | number | boolean> | null;
}

const SIMULATION_SOURCE_PREFIX = 'sim';

/**
 * Domain invariants enforced on every Observation, regardless of how it was
 * constructed. Thrown errors are deliberate — an invalid Observation must
 * never silently reach the UI.
 */
export function assertValidObservation(obs: Observation<unknown>): void {
  if (!obs.id) {
    throw new Error('Observation is missing an id');
  }
  if (!Number.isFinite(obs.timestamp)) {
    throw new Error(`Observation "${obs.type}" is missing a valid timestamp`);
  }
  if (obs.status === 'OK' && obs.value === null) {
    throw new Error(`Observation "${obs.type}" is marked OK but has no value`);
  }
  if (obs.status !== 'OK' && obs.value !== null) {
    throw new Error(`Observation "${obs.type}" has a value but status is "${obs.status}"`);
  }
  if (obs.confidence !== null && (obs.confidence < 0 || obs.confidence > 1)) {
    throw new Error(`Observation "${obs.type}" has an out-of-range confidence: ${obs.confidence}`);
  }
  const fromSimulation = obs.source.toLowerCase().startsWith(SIMULATION_SOURCE_PREFIX) ||
    obs.source === 'simulation-engine';
  if (fromSimulation && (obs.provenance === 'MEASURED' || obs.provenance === 'EXTERNAL' || obs.provenance === 'USER_REPORTED')) {
    throw new Error(
      `Observation "${obs.type}" comes from a simulation source ("${obs.source}") but claims provenance "${obs.provenance}" — a simulated source can never be MEASURED, EXTERNAL, or USER_REPORTED.`
    );
  }
}

export interface ObservationContext {
  farmId?: string | null;
  fieldId?: string | null;
  zoneId?: string | null;
  sensorId?: string | null;
  missionId?: string | null;
  droneId?: string | null;
  metadata?: Record<string, string | number | boolean> | null;
}

/** Build a SIMULATED observation. This is the only factory the simulation layer should use. */
export function createSimulatedObservation<T>(
  params: {
    type: string;
    value: T;
    unit: string | null;
    timestamp: number;
    location?: ObservationLocation | null;
    source: string;
    confidence?: number | null;
  } & ObservationContext
): Observation<T> {
  const obs: Observation<T> = {
    id: createId(`obs_${params.type}`),
    type: params.type,
    value: params.value,
    unit: params.unit,
    timestamp: params.timestamp,
    location: params.location ?? null,
    source: params.source,
    provenance: 'SIMULATED',
    confidence: params.confidence ?? null,
    status: 'OK',
    farmId: params.farmId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    sensorId: params.sensorId ?? null,
    missionId: params.missionId ?? null,
    droneId: params.droneId ?? null,
    metadata: params.metadata ?? null
  };
  assertValidObservation(obs);
  return obs;
}

/** Build an explicit "we have nothing" observation — used instead of inventing a value. */
export function createUnavailableObservation(
  params: { type: string; timestamp: number; source: string } & ObservationContext
): Observation<never> {
  const obs: Observation<never> = {
    id: createId(`obs_${params.type}`),
    type: params.type,
    value: null as never,
    unit: null,
    timestamp: params.timestamp,
    location: null,
    source: params.source,
    provenance: 'UNKNOWN',
    confidence: null,
    status: 'UNAVAILABLE',
    farmId: params.farmId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    sensorId: params.sensorId ?? null,
    missionId: params.missionId ?? null,
    droneId: params.droneId ?? null,
    metadata: params.metadata ?? null
  };
  assertValidObservation(obs);
  return obs;
}
