import { createId } from '../domain/id';
import type { Observation } from '../observation/Observation';

export type ChangeDirection = 'INCREASED' | 'DECREASED' | 'STABLE' | 'INSUFFICIENT_DATA';

export interface TemporalChangeResult {
  id: string;
  observationIdA: string;
  observationIdB: string;
  direction: ChangeDirection;
  /** valueB - valueA, or null when the comparison couldn't be made. */
  delta: number | null;
  intervalMs: number | null;
  method: string;
  reason: string | null;
  computedAt: number;
}

/**
 * A relative-change threshold, not a statistical significance test — this
 * makes no claim about whether a change is agronomically meaningful, only
 * whether it's larger than measurement noise would plausibly explain for a
 * value near zero. Documented here rather than silently baked in.
 */
const STABLE_THRESHOLD_FRACTION = 0.02;

/**
 * Compares two Observations of the same type from the same spatial
 * reference. Makes no causal claim (Part 19 of the Phase 4 brief is
 * explicit: not yet) — only reports direction and magnitude.
 */
export function compareObservations(a: Observation<number>, b: Observation<number>): TemporalChangeResult {
  const computedAt = Date.now();
  const base = { id: createId('temporal_change'), observationIdA: a.id, observationIdB: b.id, computedAt, method: 'relative_threshold_comparison' };

  if (a.type !== b.type) {
    return { ...base, direction: 'INSUFFICIENT_DATA', delta: null, intervalMs: null, reason: `Observations have different types ("${a.type}" vs "${b.type}") and are not comparable.` };
  }
  if (a.value === null || b.value === null) {
    return { ...base, direction: 'INSUFFICIENT_DATA', delta: null, intervalMs: null, reason: 'One or both observations have no value.' };
  }
  const sameZone = (a.zoneId ?? null) === (b.zoneId ?? null);
  const sameField = (a.fieldId ?? null) === (b.fieldId ?? null);
  if (!sameField || !sameZone) {
    return { ...base, direction: 'INSUFFICIENT_DATA', delta: null, intervalMs: null, reason: 'Observations do not share the same field/zone — not spatially comparable.' };
  }

  const delta = b.value - a.value;
  const intervalMs = b.timestamp - a.timestamp;
  const scale = Math.max(Math.abs(a.value), Math.abs(b.value), 1e-9);
  const direction: ChangeDirection = Math.abs(delta) / scale < STABLE_THRESHOLD_FRACTION ? 'STABLE' : delta > 0 ? 'INCREASED' : 'DECREASED';

  return { ...base, direction, delta, intervalMs, reason: null };
}
