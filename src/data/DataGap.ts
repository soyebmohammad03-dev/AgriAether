import type { FieldCoverageReport } from './Coverage';

export type DataGapType =
  | 'MISSING_SENSOR'
  | 'MISSING_TIMESTAMPS'
  | 'INSUFFICIENT_SPATIAL_COVERAGE'
  | 'STALE_OBSERVATIONS';

export interface DataGap {
  type: DataGapType;
  description: string;
}

/** An observation older than this is flagged as a staleness gap, not silently treated as current. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const LOW_SPATIAL_COVERAGE_PERCENT = 50;

/**
 * Turns a FieldCoverageReport into an explicit list of what's missing —
 * the mechanism a future mission planner (not built yet) would read to
 * decide what a drone should collect next. Every gap here is derived from
 * a real absence already computed by computeFieldCoverage, never invented.
 */
export function detectDataGaps(coverage: FieldCoverageReport): DataGap[] {
  const gaps: DataGap[] = [];

  for (const [category, status] of Object.entries(coverage.sensorCoverage)) {
    if (status === 'unavailable') {
      gaps.push({ type: 'MISSING_SENSOR', description: `No ${category} sensor is deployed for field "${coverage.fieldId}".` });
    }
  }

  if (coverage.temporalCoverage.latestObservation === null) {
    gaps.push({ type: 'MISSING_TIMESTAMPS', description: `Field "${coverage.fieldId}" has no timestamped observations at all.` });
  } else if (coverage.freshnessMs !== null && coverage.freshnessMs > STALE_AFTER_MS) {
    gaps.push({ type: 'STALE_OBSERVATIONS', description: `Most recent observation for field "${coverage.fieldId}" is over ${Math.round(coverage.freshnessMs / (60 * 60 * 1000))}h old.` });
  }

  if (coverage.spatialCoveragePercent !== null && coverage.spatialCoveragePercent < LOW_SPATIAL_COVERAGE_PERCENT) {
    gaps.push({ type: 'INSUFFICIENT_SPATIAL_COVERAGE', description: `Only ${coverage.spatialCoveragePercent.toFixed(0)}% of field "${coverage.fieldId}" has valid raster coverage.` });
  }

  return gaps;
}
