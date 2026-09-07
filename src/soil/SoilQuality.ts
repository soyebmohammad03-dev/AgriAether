import { deriveDataQuality, type DataQuality } from '../sensing/DataQuality';
import { isWithinRange } from '../sensing/Units';
import { MEASUREMENT_PLAUSIBLE_RANGES, type SoilMeasurements, type SoilSample } from './SoilSample';

const KNOWN_MEASUREMENT_KEYS: Array<keyof SoilMeasurements> = ['moisturePercent', 'temperatureC', 'ec', 'ph', 'nitrogenPpm', 'phosphorusPpm', 'potassiumPpm'];

export type MoistureStatus = 'DRY' | 'ADEQUATE' | 'SATURATED';
export type EcStatus = 'LOW' | 'NORMAL' | 'HIGH' | 'SALINE';
export type PhStatus = 'ACIDIC' | 'SLIGHTLY_ACIDIC' | 'NEUTRAL' | 'SLIGHTLY_ALKALINE' | 'ALKALINE';

/**
 * Generic, widely-cited agronomic interpretation bands — not crop-specific,
 * not a recommendation. A real agronomic threshold depends on crop, soil
 * type, and growth stage; these exist only to turn a raw number into a
 * coarse, defensible category, the same way DataQuality turns a reading
 * into VALID/QUESTIONABLE/etc rather than inventing a health score.
 */
export function moistureStatus(percent: number): MoistureStatus {
  if (percent < 15) return 'DRY';
  if (percent > 35) return 'SATURATED';
  return 'ADEQUATE';
}

/** Generic EC bands (dS/m, saturated-paste-equivalent scale). Most crops tolerate up to ~2 dS/m; above ~4 dS/m is conventionally "saline" in soil science. */
export function ecStatus(dsPerM: number): EcStatus {
  if (dsPerM < 0.8) return 'LOW';
  if (dsPerM <= 2) return 'NORMAL';
  if (dsPerM <= 4) return 'HIGH';
  return 'SALINE';
}

/** Standard soil-science pH bands (aqueous scale). */
export function phStatus(ph: number): PhStatus {
  if (ph < 5.5) return 'ACIDIC';
  if (ph < 6.5) return 'SLIGHTLY_ACIDIC';
  if (ph <= 7.3) return 'NEUTRAL';
  if (ph <= 7.8) return 'SLIGHTLY_ALKALINE';
  return 'ALKALINE';
}

/** Per-measurement DataQuality — currently only a range check (samples carry no calibration/staleness metadata of their own; see sensing/SensorHealth.ts for that axis on live sensors). */
export function measurementDataQuality(sample: SoilSample): Partial<Record<keyof SoilMeasurements, DataQuality>> {
  const result: Partial<Record<keyof SoilMeasurements, DataQuality>> = {};
  for (const key of KNOWN_MEASUREMENT_KEYS) {
    const value = sample.measurements[key];
    if (value === undefined) continue;
    result[key] = deriveDataQuality({ hasValue: true, value, plausibleRange: MEASUREMENT_PLAUSIBLE_RANGES[key] });
  }
  return result;
}

export interface SoilCompleteness {
  presentCount: number;
  totalKnownMeasurements: number;
  fraction: number;
  missing: Array<keyof SoilMeasurements>;
}

/** How many of the known soil quantities this sample actually reports — never assumes a missing quantity is zero. */
export function soilSampleCompleteness(sample: SoilSample): SoilCompleteness {
  const present = KNOWN_MEASUREMENT_KEYS.filter((key) => sample.measurements[key] !== undefined);
  const missing = KNOWN_MEASUREMENT_KEYS.filter((key) => sample.measurements[key] === undefined);
  return {
    presentCount: present.length,
    totalKnownMeasurements: KNOWN_MEASUREMENT_KEYS.length,
    fraction: present.length / KNOWN_MEASUREMENT_KEYS.length,
    missing
  };
}

export interface SoilSampleQualitySummary {
  measurementQuality: Partial<Record<keyof SoilMeasurements, DataQuality>>;
  completeness: SoilCompleteness;
  moistureStatus: MoistureStatus | null;
  ecStatus: EcStatus | null;
  phStatus: PhStatus | null;
  /** True if any present measurement fell outside MEASUREMENT_PLAUSIBLE_RANGES — a flag for the UI, not a rejection (the sample is still persisted as reported). */
  hasOutOfRangeMeasurement: boolean;
}

export function summarizeSoilSampleQuality(sample: SoilSample): SoilSampleQualitySummary {
  const measurementQuality = measurementDataQuality(sample);
  return {
    measurementQuality,
    completeness: soilSampleCompleteness(sample),
    moistureStatus: sample.measurements.moisturePercent !== undefined && isWithinRange(sample.measurements.moisturePercent, MEASUREMENT_PLAUSIBLE_RANGES.moisturePercent)
      ? moistureStatus(sample.measurements.moisturePercent)
      : null,
    ecStatus: sample.measurements.ec !== undefined && isWithinRange(sample.measurements.ec, MEASUREMENT_PLAUSIBLE_RANGES.ec) ? ecStatus(sample.measurements.ec) : null,
    phStatus: sample.measurements.ph !== undefined && isWithinRange(sample.measurements.ph, MEASUREMENT_PLAUSIBLE_RANGES.ph) ? phStatus(sample.measurements.ph) : null,
    hasOutOfRangeMeasurement: Object.values(measurementQuality).some((q) => q === 'OUT_OF_RANGE')
  };
}
