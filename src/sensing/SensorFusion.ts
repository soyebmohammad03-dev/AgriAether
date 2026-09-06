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
