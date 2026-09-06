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

/**
 * Where an Observation was made, in one of two frames that must never be
 * silently conflated: the 3D simulation's own local axes, or a real
 * geographic (WGS84) position. A consumer must always check `frame` before
 * touching `x`/`y`/`z` or `lat`/`lon` — there is deliberately no shared
 * shape that would let the two be mixed up.
 */
export type ObservationLocation =
  | {
      frame: 'simulation-local';
      /** Meters, simulation-local axes. */
      x: number;
      y: number;
      z: number;
    }
  | {
      frame: 'geodetic';
      crs: 'EPSG:4326';
      lat: number;
      lon: number;
      /** Meters above the WGS84 ellipsoid, or null if not known. */
      altitude?: number | null;
      /** Meters, 1-sigma horizontal accuracy if the source states one; null if unknown. */
      horizontalAccuracyMeters?: number | null;
    };

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

/**
 * Source-prefix -> disallowed-provenance rules (Phase 4, Part 29's
 * scientific-honesty constraints made structural rather than just
 * documented). Each entry says: a source matching this pattern can never
 * claim one of these provenances, because doing so would misattribute
 * where the value actually came from — a simulation source pretending to
 * be a real instrument, an external API pretending to be a sensor, a model
 * output pretending to be a direct reading.
 */
const SOURCE_PROVENANCE_RULES: Array<{ matches: (source: string) => boolean; disallowed: Provenance[]; description: string }> = [
  {
    matches: (s) => s.toLowerCase().startsWith('sim') || s === 'simulation-engine' || s.toLowerCase().startsWith('synthetic'),
    disallowed: ['MEASURED', 'EXTERNAL', 'USER_REPORTED'],
    description: 'a simulated or synthetic source can never be MEASURED, EXTERNAL, or USER_REPORTED'
  },
  {
    matches: (s) => s.startsWith('external:'),
    disallowed: ['MEASURED', 'SIMULATED', 'USER_REPORTED'],
    description: 'an external-provider source can never be MEASURED, SIMULATED, or USER_REPORTED'
  },
  {
    matches: (s) => s.startsWith('model:'),
    disallowed: ['MEASURED', 'SIMULATED', 'EXTERNAL', 'USER_REPORTED'],
    description: 'a model source can never be MEASURED, SIMULATED, EXTERNAL, or USER_REPORTED — a prediction is not a measurement'
  }
];

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
  for (const rule of SOURCE_PROVENANCE_RULES) {
    if (rule.matches(obs.source) && rule.disallowed.includes(obs.provenance)) {
      throw new Error(
        `Observation "${obs.type}" comes from source "${obs.source}" but claims provenance "${obs.provenance}" — ${rule.description}.`
      );
    }
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

/** Build an ESTIMATED observation — a value derived from another observation via a stated model/formula (e.g. a demo geodetic position computed from a simulated one). Never used for a raw sensor or simulation reading; those are createSimulatedObservation's job. */
export function createEstimatedObservation<T>(
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
    provenance: 'ESTIMATED',
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

/**
 * Build a PREDICTED observation — the output of an ML model, never a
 * measurement. `source` must identify the model as `model:<modelId>` (see
 * sensing/ModelRegistry.ts) so assertValidObservation's source-based rules
 * apply; `metadata` should carry the model version.
 */
export function createPredictedObservation<T>(
  params: {
    type: string;
    value: T;
    unit: string | null;
    timestamp: number;
    location?: ObservationLocation | null;
    modelId: string;
    modelVersion: string;
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
    source: `model:${params.modelId}`,
    provenance: 'PREDICTED',
    confidence: params.confidence ?? null,
    status: 'OK',
    farmId: params.farmId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    sensorId: params.sensorId ?? null,
    missionId: params.missionId ?? null,
    droneId: params.droneId ?? null,
    metadata: { ...(params.metadata ?? {}), modelVersion: params.modelVersion }
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
