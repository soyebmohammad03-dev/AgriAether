import type { CalibrationStatus } from '../domain/SensorRecord';
import { isWithinRange, type PlausibleRange } from './Units';

/**
 * Data quality is orthogonal to Provenance (observation/Observation.ts):
 * provenance says WHERE a value came from (measured/simulated/external/…),
 * quality says HOW TRUSTWORTHY it currently is. "EXTERNAL + STALE" and
 * "SIMULATED + VALID" are both entirely coherent states — the two axes are
 * deliberately never merged into one field.
 */
export type DataQuality =
  | 'VALID'
  | 'QUESTIONABLE'
  | 'INVALID'
  | 'MISSING'
  | 'STALE'
  | 'INSUFFICIENT_DATA'
  | 'UNSUPPORTED'
  | 'CALIBRATION_REQUIRED'
  | 'OUT_OF_RANGE';

/**
 * A small, explicit rule set — not a scoring model. Calibration, staleness,
 * and range all override an otherwise-valid reading; nothing here invents a
 * numeric confidence. Range is checked last so a missing/uncalibrated/stale
 * reading is reported as that, not as OUT_OF_RANGE, when both apply.
 */
export function deriveDataQuality(params: {
  hasValue: boolean;
  calibrationStatus?: CalibrationStatus;
  ageMs?: number;
  staleAfterMs?: number;
  value?: number;
  plausibleRange?: PlausibleRange;
}): DataQuality {
  if (!params.hasValue) return 'MISSING';
  if (params.calibrationStatus === 'UNCALIBRATED') return 'CALIBRATION_REQUIRED';
  if (params.staleAfterMs !== undefined && params.ageMs !== undefined && params.ageMs > params.staleAfterMs) {
    return 'STALE';
  }
  if (params.plausibleRange !== undefined && params.value !== undefined && !isWithinRange(params.value, params.plausibleRange)) {
    return 'OUT_OF_RANGE';
  }
  if (params.calibrationStatus === 'UNKNOWN') return 'QUESTIONABLE';
  return 'VALID';
}
