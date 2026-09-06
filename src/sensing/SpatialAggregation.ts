import { createId } from '../domain/id';
import type { Observation } from '../observation/Observation';

export type AggregationStatistic = 'mean' | 'min' | 'max' | 'count';

/**
 * An aggregated statistic over a set of raw Observations — deliberately a
 * different shape from Observation itself, so nothing downstream can
 * mistake a zone-level mean for one individual sensor reading. Always
 * names its inputs (`sourceObservationIds`) rather than just a number.
 */
export interface AggregationResult {
  id: string;
  type: string;
  zoneId: string | null;
  fieldId: string | null;
  statistic: AggregationStatistic;
  value: number;
  unit: string | null;
  sampleCount: number;
  sourceObservationIds: string[];
  computedAt: number;
  method: string;
}

/**
 * Aggregates same-type Observations sharing a zone (or field, if no zoneId
 * is given) into mean/min/max/count. Throws on an empty or mixed-type
 * input rather than silently returning a meaningless number.
 */
export function aggregateObservations(observations: Observation<number>[], statistic: AggregationStatistic): AggregationResult {
  if (observations.length === 0) {
    throw new Error('Cannot aggregate an empty observation set');
  }
  const [first, ...rest] = observations;
  if (rest.some((o) => o.type !== first.type)) {
    throw new Error('Cannot aggregate observations of different types');
  }
  const values = observations.map((o) => o.value).filter((v): v is number => v !== null);
  if (values.length === 0) {
    throw new Error('No observation in the set has a value to aggregate');
  }

  const value =
    statistic === 'count'
      ? values.length
      : statistic === 'mean'
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : statistic === 'min'
          ? Math.min(...values)
          : Math.max(...values);

  return {
    id: createId('aggregation'),
    type: first.type,
    zoneId: first.zoneId ?? null,
    fieldId: first.fieldId ?? null,
    statistic,
    value,
    unit: first.unit,
    sampleCount: values.length,
    sourceObservationIds: observations.map((o) => o.id),
    computedAt: Date.now(),
    method: `${statistic} over ${values.length} observations of type "${first.type}"`
  };
}
