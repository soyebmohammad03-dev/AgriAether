import type { Observation } from '../observation/Observation';

/**
 * Reports what's actually available to combine — never combines it into a
 * score. Per Part 23 of the Phase 4 brief: "DO NOT yet produce magical
 * 'overall crop health' scores." A future validated model is what turns
 * this inventory into a prediction (see ModelRegistry.ts); this function
 * only ever describes the inputs that would go into one.
 */
export interface FusionInventory {
  observationTypes: string[];
  timeRangeMs: [number, number] | null;
  locationFrames: Array<'simulation-local' | 'geodetic'>;
  averageConfidence: number | null;
  countByProvenance: Record<string, number>;
}

export function buildFusionInventory(observations: ReadonlyArray<Observation<unknown>>): FusionInventory {
  if (observations.length === 0) {
    return { observationTypes: [], timeRangeMs: null, locationFrames: [], averageConfidence: null, countByProvenance: {} };
  }

  const types = new Set<string>();
  const frames = new Set<'simulation-local' | 'geodetic'>();
  const countByProvenance: Record<string, number> = {};
  let minTs = Infinity;
  let maxTs = -Infinity;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const obs of observations) {
    types.add(obs.type);
    if (obs.location) frames.add(obs.location.frame);
    countByProvenance[obs.provenance] = (countByProvenance[obs.provenance] ?? 0) + 1;
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
    countByProvenance
  };
}
