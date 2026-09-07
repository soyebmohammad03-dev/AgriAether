import type { CropObservation } from './CropObservation';
import type { GrowthStage } from './Crop';

export type GrowthStageProgression = 'ADVANCED' | 'UNCHANGED' | 'REGRESSED' | 'UNKNOWN';

/** The one place growth-stage order is defined — UNKNOWN is deliberately excluded from the ordinal sequence, so comparing against an UNKNOWN stage always yields UNKNOWN progression rather than a fabricated ordering. */
const STAGE_ORDER: GrowthStage[] = ['PLANTED', 'EMERGENCE', 'VEGETATIVE', 'FLOWERING', 'MATURITY', 'HARVESTED'];

function stageOrdinal(stage: GrowthStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export interface CropObservationComparison {
  fromObservationId: string;
  toObservationId: string;
  fromStage: GrowthStage;
  toStage: GrowthStage;
  progression: GrowthStageProgression;
  daySpan: number;
  conditionNoteChanged: boolean;
  reason: string | null;
}

/** Compares two CropObservations for the same field, ordered by timestamp — never assumes chronological input order. */
export function compareCropObservations(a: CropObservation, b: CropObservation): CropObservationComparison {
  const [earlier, later] = a.timestamp <= b.timestamp ? [a, b] : [b, a];
  const daySpan = (later.timestamp - earlier.timestamp) / 86_400_000;

  if (earlier.fieldId !== later.fieldId) {
    return {
      fromObservationId: earlier.id,
      toObservationId: later.id,
      fromStage: earlier.growthStage,
      toStage: later.growthStage,
      progression: 'UNKNOWN',
      daySpan,
      conditionNoteChanged: earlier.observedCondition !== later.observedCondition,
      reason: 'Observations belong to different fields — not comparable.'
    };
  }

  const fromOrdinal = stageOrdinal(earlier.growthStage);
  const toOrdinal = stageOrdinal(later.growthStage);
  const progression: GrowthStageProgression =
    fromOrdinal === -1 || toOrdinal === -1 ? 'UNKNOWN' : toOrdinal > fromOrdinal ? 'ADVANCED' : toOrdinal < fromOrdinal ? 'REGRESSED' : 'UNCHANGED';

  return {
    fromObservationId: earlier.id,
    toObservationId: later.id,
    fromStage: earlier.growthStage,
    toStage: later.growthStage,
    progression,
    daySpan,
    conditionNoteChanged: earlier.observedCondition !== later.observedCondition,
    reason: progression === 'UNKNOWN' ? 'One or both observations have an UNKNOWN growth stage — no ordering can be inferred.' : null
  };
}

export interface FieldCropStatusSummary {
  fieldId: string;
  observationCount: number;
  latestObservationId: string | null;
  latestGrowthStage: GrowthStage | null;
  latestObservedAt: number | null;
  latestCultivar: string | null;
  /** Only set when there are >= 2 observations to compare — never fabricated from a single reading. */
  recentComparison: CropObservationComparison | null;
}

/** A deterministic summary of a field's crop observations — no score, no health index, just what was actually recorded and (if enough data exists) the direction of change since the previous observation. */
export function summarizeFieldCropStatus(fieldId: string, observations: CropObservation[]): FieldCropStatusSummary {
  const forField = observations.filter((o) => o.fieldId === fieldId).sort((a, b) => a.timestamp - b.timestamp);

  if (forField.length === 0) {
    return { fieldId, observationCount: 0, latestObservationId: null, latestGrowthStage: null, latestObservedAt: null, latestCultivar: null, recentComparison: null };
  }

  const latest = forField[forField.length - 1];
  const previous = forField.length >= 2 ? forField[forField.length - 2] : null;

  return {
    fieldId,
    observationCount: forField.length,
    latestObservationId: latest.id,
    latestGrowthStage: latest.growthStage,
    latestObservedAt: latest.timestamp,
    latestCultivar: latest.cultivar,
    recentComparison: previous ? compareCropObservations(previous, latest) : null
  };
}
