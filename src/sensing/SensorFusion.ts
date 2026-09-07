import { createId } from '../domain/id';
import type { Observation } from '../observation/Observation';

/**
 * Reports what's actually available to combine — never combines it into a
 * score. Per Part 23 of the Phase 4 brief: "DO NOT yet produce magical
 * 'overall crop health' scores." A future validated model is what turns
 * this inventory into a prediction (see ModelRegistry.ts); this function
 * only ever describes the inputs that would go into one.
 */
/**
 * Which broad category an Observation's source belongs to — the grouping a
 * future fusion step needs to reason about "drone + ground + weather +
 * historical" as distinct streams (Part 6 of the Phase 6 brief) without
 * collapsing them. Derived structurally from `type`/`source` prefixes that
 * are already established conventions elsewhere in the codebase (see
 * weatherObservationToObservations.ts's "weather." types and
 * "external:"-prefixed sources, groundSampleToObservations.ts's "ground."
 * types, soilSampleToObservations.ts's "soil." types) — never guessed.
 */
export type SourceCategory = 'drone' | 'ground-sensor' | 'soil' | 'weather' | 'historical' | 'other';

export function categorizeSource(obs: Observation<unknown>): SourceCategory {
  if (obs.droneId) return 'drone';
  if (obs.type.startsWith('weather.')) return 'weather';
  if (obs.type.startsWith('soil.')) return 'soil';
  if (obs.type.startsWith('ground.')) return 'ground-sensor';
  if (obs.type.startsWith('drone.')) return 'drone';
  if (obs.provenance === 'MEASURED' && obs.sensorId) return 'ground-sensor';
  return 'other';
}

export interface FusionInventory {
  observationTypes: string[];
  timeRangeMs: [number, number] | null;
  locationFrames: Array<'simulation-local' | 'geodetic'>;
  averageConfidence: number | null;
  countByProvenance: Record<string, number>;
  countBySourceCategory: Record<SourceCategory, number>;
}

export function buildFusionInventory(observations: ReadonlyArray<Observation<unknown>>): FusionInventory {
  if (observations.length === 0) {
    return {
      observationTypes: [],
      timeRangeMs: null,
      locationFrames: [],
      averageConfidence: null,
      countByProvenance: {},
      countBySourceCategory: { drone: 0, 'ground-sensor': 0, soil: 0, weather: 0, historical: 0, other: 0 }
    };
  }

  const types = new Set<string>();
  const frames = new Set<'simulation-local' | 'geodetic'>();
  const countByProvenance: Record<string, number> = {};
  const countBySourceCategory: Record<SourceCategory, number> = { drone: 0, 'ground-sensor': 0, soil: 0, weather: 0, historical: 0, other: 0 };
  let minTs = Infinity;
  let maxTs = -Infinity;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const obs of observations) {
    types.add(obs.type);
    if (obs.location) frames.add(obs.location.frame);
    countByProvenance[obs.provenance] = (countByProvenance[obs.provenance] ?? 0) + 1;
    countBySourceCategory[categorizeSource(obs)] += 1;
    minTs = Math.min(minTs, obs.timestamp);
    maxTs = Math.max(maxTs, obs.timestamp);
    if (obs.confidence !== null) {
      confidenceSum += obs.confidence;
      confidenceCount += 1;
    }
  }

  return {
    observationTypes: Array.from(types),
    timeRangeMs: [minTs, maxTs],
    locationFrames: Array.from(frames),
    averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
    countByProvenance,
    countBySourceCategory
  };
}

/** How stale an Observation is allowed to get before evidence alignment stops treating it as current. Same order of magnitude as DataGap.ts's STALE_AFTER_MS, kept separate because fusion evidence and coverage gaps are different concerns. */
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Two OK numeric observations of the same type disagree by more than this
 * fraction of their shared magnitude — a real conflict to surface, not a
 * value to silently average away. Mirrors TemporalChange.ts's
 * STABLE_THRESHOLD_FRACTION intent but kept as its own constant since
 * fusion and temporal-change are different questions (do two sources
 * agree right now vs did one source change over time).
 */
const CONFLICT_THRESHOLD_FRACTION = 0.1;

export type Freshness = 'CURRENT' | 'STALE';

export interface EvidenceItem {
  type: string;
  observation: Observation<unknown>;
  sourceCategory: SourceCategory;
  ageMs: number;
  freshness: Freshness;
}

export interface ObservationConflict {
  type: string;
  observationIds: string[];
  reason: string;
}

/**
 * One deterministic bundle of evidence for a field (and optionally zone)
 * within a time window: the latest OK observation per type, any same-type
 * disagreements found, and which of the caller's expected types have none
 * at all. This is evidence alignment, not fusion into a single value — see
 * the module doc: a future ML model replaces the "how do we combine this"
 * step, not this step.
 */
export interface FusedEvidenceBundle {
  id: string;
  fieldId: string;
  zoneId: string | null;
  windowStartMs: number;
  windowEndMs: number;
  items: EvidenceItem[];
  conflicts: ObservationConflict[];
  missingTypes: string[];
  sourceObservationIds: string[];
  averageConfidence: number | null;
}

/**
 * Aligns observations for one field/zone/window by type: picks the latest
 * OK reading per type (never invents or interpolates a missing one),
 * flags same-type readings that disagree beyond CONFLICT_THRESHOLD_FRACTION,
 * and reports missing/stale honestly instead of masking them.
 */
export function alignObservationEvidence(params: {
  observations: ReadonlyArray<Observation<unknown>>;
  fieldId: string;
  zoneId?: string | null;
  windowStartMs: number;
  windowEndMs: number;
  now?: number;
  staleAfterMs?: number;
  expectedTypes?: readonly string[];
}): FusedEvidenceBundle {
  const now = params.now ?? Date.now();
  const staleAfterMs = params.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const zoneId = params.zoneId ?? null;

  const inWindow = params.observations.filter(
    (o) =>
      o.fieldId === params.fieldId &&
      (zoneId === null || o.zoneId === zoneId) &&
      o.timestamp >= params.windowStartMs &&
      o.timestamp <= params.windowEndMs
  );

  const byType = new Map<string, Observation<unknown>[]>();
  for (const obs of inWindow) {
    const list = byType.get(obs.type) ?? [];
    list.push(obs);
    byType.set(obs.type, list);
  }

  const items: EvidenceItem[] = [];
  const conflicts: ObservationConflict[] = [];
  for (const [type, group] of byType) {
    const okGroup = group.filter((o) => o.status === 'OK');
    if (okGroup.length === 0) continue;

    const numericValues = okGroup.filter((o): o is Observation<number> => typeof o.value === 'number');
    if (numericValues.length > 1) {
      const values = numericValues.map((o) => o.value as number);
      const scale = Math.max(...values.map((v) => Math.abs(v)), 1e-9);
      const spread = Math.max(...values) - Math.min(...values);
      if (spread / scale > CONFLICT_THRESHOLD_FRACTION) {
        conflicts.push({
          type,
          observationIds: numericValues.map((o) => o.id),
          reason: `${numericValues.length} "${type}" readings in this window disagree by more than ${(CONFLICT_THRESHOLD_FRACTION * 100).toFixed(0)}%.`
        });
      }
    }

    const latest = okGroup.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    const ageMs = now - latest.timestamp;
    items.push({
      type,
      observation: latest,
      sourceCategory: categorizeSource(latest),
      ageMs,
      freshness: ageMs > staleAfterMs ? 'STALE' : 'CURRENT'
    });
  }

  const presentTypes = new Set(items.map((i) => i.type));
  const missingTypes = (params.expectedTypes ?? []).filter((t) => !presentTypes.has(t));

  const confidences = items.map((i) => i.observation.confidence).filter((c): c is number => c !== null);

  return {
    id: createId('evidence_bundle'),
    fieldId: params.fieldId,
    zoneId,
    windowStartMs: params.windowStartMs,
    windowEndMs: params.windowEndMs,
    items,
    conflicts,
    missingTypes,
    sourceObservationIds: items.map((i) => i.observation.id),
    averageConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
  };
}
