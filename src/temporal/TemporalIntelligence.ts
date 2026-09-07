import { createId } from '../domain/id';
import type { Observation } from '../observation/Observation';
import { compareObservations, type TemporalChangeResult } from '../sensing/TemporalChange';

/**
 * Reusable time-axis utilities shared across twin/graph/fusion code.
 * Deliberately thin wrappers over what already exists (ObservationQuery.ts
 * for latest-of-type, TemporalChange.ts for direction) plus the handful of
 * generic operations — freshness, window summary, gap detection — nothing
 * else in the codebase yet provides. Never interpolates a missing reading.
 */

export type Freshness = 'CURRENT' | 'STALE' | 'UNKNOWN';

export function classifyFreshness(observation: Observation<unknown> | null, now: number, staleAfterMs: number): Freshness {
  if (!observation) return 'UNKNOWN';
  return now - observation.timestamp > staleAfterMs ? 'STALE' : 'CURRENT';
}

export interface WindowSummary {
  type: string;
  fieldId: string | null;
  windowStartMs: number;
  windowEndMs: number;
  count: number;
  earliest: Observation<unknown> | null;
  latest: Observation<unknown> | null;
  /** Numeric stats over OK observations with a value in-window; null when none are numeric. */
  mean: number | null;
  min: number | null;
  max: number | null;
  sourceObservationIds: string[];
}

/** Deterministic summary of one type's observations within [sinceMs, untilMs] for a field. An empty window is a valid, honest result (count 0, every stat null), never an error. */
export function summarizeWindow(
  observations: ReadonlyArray<Observation<unknown>>,
  fieldId: string,
  type: string,
  sinceMs: number,
  untilMs: number
): WindowSummary {
  const inWindow = observations
    .filter((o) => o.fieldId === fieldId && o.type === type && o.timestamp >= sinceMs && o.timestamp <= untilMs)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  const numericOk = inWindow.filter((o): o is Observation<number> => o.status === 'OK' && typeof o.value === 'number');
  const values = numericOk.map((o) => o.value as number);

  return {
    type,
    fieldId,
    windowStartMs: sinceMs,
    windowEndMs: untilMs,
    count: inWindow.length,
    earliest: inWindow[0] ?? null,
    latest: inWindow[inWindow.length - 1] ?? null,
    mean: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
    sourceObservationIds: inWindow.map((o) => o.id)
  };
}

export interface TemporalGap {
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * Enumerates gaps in a timestamp series larger than expectedIntervalMs
 * (scaled by toleranceFactor) — including a leading gap if the first
 * reading arrives late and a trailing gap if the last one is stale — over
 * [sinceMs, untilMs]. Distinct from DataGap.ts, which reports a single
 * field-level "is this stale" flag; this enumerates every missing period.
 */
export function findTemporalGaps(
  timestamps: readonly number[],
  sinceMs: number,
  untilMs: number,
  expectedIntervalMs: number,
  toleranceFactor = 1.5
): TemporalGap[] {
  const sorted = timestamps.filter((t) => t >= sinceMs && t <= untilMs).slice().sort((a, b) => a - b);
  const threshold = expectedIntervalMs * toleranceFactor;
  const gaps: TemporalGap[] = [];

  let cursor = sinceMs;
  for (const t of sorted) {
    if (t - cursor > threshold) {
      gaps.push({ startMs: cursor, endMs: t, durationMs: t - cursor });
    }
    cursor = t;
  }
  if (untilMs - cursor > threshold) {
    gaps.push({ startMs: cursor, endMs: untilMs, durationMs: untilMs - cursor });
  }
  return gaps;
}

export interface TrendResult extends TemporalChangeResult {
  sampleCount: number;
}

/**
 * Direction of change across a window, computed honestly as first-vs-last
 * (via TemporalChange.compareObservations) rather than a fitted regression
 * — no modeled trend line, just what the earliest and latest readings show.
 * Returns null when fewer than two observations exist in-window.
 */
export function trendDirection(observations: ReadonlyArray<Observation<number>>, fieldId: string, type: string, sinceMs: number, untilMs: number): TrendResult | null {
  const inWindow = observations
    .filter((o) => o.fieldId === fieldId && o.type === type && o.timestamp >= sinceMs && o.timestamp <= untilMs)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);
  if (inWindow.length < 2) return null;
  const result = compareObservations(inWindow[0], inWindow[inWindow.length - 1]);
  return { ...result, sampleCount: inWindow.length };
}

/**
 * Compares the last observation of `type` strictly before `cutoverMs`
 * against the first one at/after it — e.g. before/after a treatment or
 * event. INSUFFICIENT_DATA (via compareObservations) when either side has
 * nothing.
 */
export function compareBeforeAfter(
  observations: ReadonlyArray<Observation<number>>,
  fieldId: string,
  type: string,
  cutoverMs: number
): TemporalChangeResult {
  const forType = observations.filter((o) => o.fieldId === fieldId && o.type === type);
  const before = forType.filter((o) => o.timestamp < cutoverMs).sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const after = forType.filter((o) => o.timestamp >= cutoverMs).sort((a, b) => a.timestamp - b.timestamp)[0] ?? null;

  if (!before || !after) {
    const computedAt = Date.now();
    return {
      id: createId('temporal_change'),
      observationIdA: before?.id ?? 'none',
      observationIdB: after?.id ?? 'none',
      direction: 'INSUFFICIENT_DATA',
      delta: null,
      intervalMs: null,
      method: 'before_after_comparison',
      reason: !before && !after ? `No "${type}" observations found on either side of the cutover.` : !before ? `No "${type}" observation found before the cutover.` : `No "${type}" observation found after the cutover.`,
      computedAt
    };
  }
  return compareObservations(before, after);
}
