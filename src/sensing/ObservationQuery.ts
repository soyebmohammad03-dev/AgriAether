import type { Observation } from '../observation/Observation';

/**
 * Read-only queries over a set of already-collected Observations — no
 * causal or predictive claims (that boundary belongs to TemporalChange.ts
 * and, eventually, a validated model). These only answer what the data
 * already shows: what exists in a window, and what expected types don't.
 */

/** Observations for a field, at or after `sinceMs`, newest first. */
export function observationsSince(
  observations: ReadonlyArray<Observation<unknown>>,
  fieldId: string,
  sinceMs: number
): Observation<unknown>[] {
  return observations
    .filter((o) => o.fieldId === fieldId && o.timestamp >= sinceMs)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Which of `expectedTypes` have zero observations for `zoneId` anywhere in
 * `observations`. Reports missing types honestly rather than assuming zero
 * observations means zero value (see DataQuality's MISSING vs a real 0).
 */
export function findMissingObservationTypes(
  observations: ReadonlyArray<Observation<unknown>>,
  zoneId: string,
  expectedTypes: ReadonlyArray<string>
): string[] {
  const presentTypes = new Set(observations.filter((o) => o.zoneId === zoneId).map((o) => o.type));
  return expectedTypes.filter((type) => !presentTypes.has(type));
}

/**
 * The most recent observation of `type` for a field, or null if none exist
 * — never a synthesized "last known value."
 */
export function latestObservationOfType(
  observations: ReadonlyArray<Observation<unknown>>,
  fieldId: string,
  type: string
): Observation<unknown> | null {
  const matches = observations.filter((o) => o.fieldId === fieldId && o.type === type);
  if (matches.length === 0) return null;
  return matches.reduce((latest, current) => (current.timestamp > latest.timestamp ? current : latest));
}
