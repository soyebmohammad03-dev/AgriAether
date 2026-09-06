import { createId } from '../domain/id';
import type { DataQuality } from '../sensing/DataQuality';
import { recordProcessingStep, type ProcessingStep } from './ProcessingStep';

export type SpatialStatistic = 'mean' | 'median' | 'min' | 'max' | 'stddev';

/** Below this fraction of the candidate cells actually having a valid value, a statistic is flagged QUESTIONABLE rather than presented with the same confidence as a well-covered one. */
const LOW_COVERAGE_THRESHOLD = 0.3;

export interface SpatialStatisticsResult {
  id: string;
  statistic: SpatialStatistic;
  value: number | null;
  sampleCount: number;
  totalCellCount: number;
  coverageFraction: number;
  quality: DataQuality;
  processingStep: ProcessingStep;
}

function computeValue(values: number[], statistic: SpatialStatistic): number {
  const sorted = [...values].sort((a, b) => a - b);
  switch (statistic) {
    case 'mean':
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case 'median': {
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    case 'min':
      return sorted[0];
    case 'max':
      return sorted[sorted.length - 1];
    case 'stddev': {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    }
  }
}

/**
 * `values` must already exclude nodata (see FieldClip.ts's
 * readClippedBandValues) — this function only ever sees valid readings.
 * `totalCellCount` is the number of candidate cells the statistic was
 * computed over before nodata exclusion, so coverage can be reported
 * honestly: a mean over 3 of 10 cells is QUESTIONABLE, a mean over 9 of 10
 * is VALID — never displayed with equal confidence.
 */
export function computeSpatialStatistics(values: number[], totalCellCount: number, statistic: SpatialStatistic): SpatialStatisticsResult {
  const coverageFraction = totalCellCount > 0 ? values.length / totalCellCount : 0;
  const quality: DataQuality = values.length === 0 ? 'INSUFFICIENT_DATA' : coverageFraction < LOW_COVERAGE_THRESHOLD ? 'QUESTIONABLE' : 'VALID';

  return {
    id: createId('spatial_stat'),
    statistic,
    value: values.length > 0 ? computeValue(values, statistic) : null,
    sampleCount: values.length,
    totalCellCount,
    coverageFraction,
    quality,
    processingStep: recordProcessingStep({
      operation: 'spatial_statistics',
      algorithmVersion: '1.0.0',
      parentIds: [],
      parameters: { statistic, sampleCount: values.length, totalCellCount }
    })
  };
}
