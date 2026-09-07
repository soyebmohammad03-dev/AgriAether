import type { Observation } from '../observation/Observation';
import type { SoilSample } from './SoilSample';
import { trendDirection, type TrendResult } from '../temporal/TemporalIntelligence';

export type NutrientStatus = 'LOW' | 'ADEQUATE' | 'HIGH';

/**
 * Generic, widely-cited row-crop soil-test interpretation bands (ppm,
 * standard extraction methods) — same philosophy as SoilQuality.ts's
 * moisture/EC/pH bands: coarse, defensible categories, never a crop-specific
 * recommendation and never a fertilizer rate.
 */
export function nitrogenStatus(ppm: number): NutrientStatus {
  if (ppm < 20) return 'LOW';
  if (ppm <= 40) return 'ADEQUATE';
  return 'HIGH';
}
export function phosphorusStatus(ppm: number): NutrientStatus {
  if (ppm < 15) return 'LOW';
  if (ppm <= 30) return 'ADEQUATE';
  return 'HIGH';
}
export function potassiumStatus(ppm: number): NutrientStatus {
  if (ppm < 100) return 'LOW';
  if (ppm <= 200) return 'ADEQUATE';
  return 'HIGH';
}

const NUTRIENT_TYPE: Record<'nitrogen' | 'phosphorus' | 'potassium', string> = {
  nitrogen: 'soil.nitrogen',
  phosphorus: 'soil.phosphorus',
  potassium: 'soil.potassium'
};

export interface NutrientReading {
  value: number;
  status: NutrientStatus;
  sampleId: string;
}

export interface NutrientEvidenceSummary {
  fieldId: string;
  zoneId: string | null;
  nitrogen: NutrientReading | null;
  phosphorus: NutrientReading | null;
  potassium: NutrientReading | null;
  /** Which of nitrogen/phosphorus/potassium have no reading on the latest sample — the honest complement to the readings above. */
  missing: string[];
  trend: Record<'soil.nitrogen' | 'soil.phosphorus' | 'soil.potassium', TrendResult | null>;
  computedAt: number;
}

/**
 * Nutrient completeness/status/trend built entirely from a field's latest
 * SoilSample plus its observation history — no fertilizer rate, no fertility
 * score. A missing N/P/K measurement is reported as missing, never assumed
 * to be zero or "sufficient."
 */
export function summarizeNutrientEvidence(params: {
  fieldId: string;
  zoneId?: string | null;
  latestSample: SoilSample | null;
  observations: ReadonlyArray<Observation<number>>;
  now?: number;
  lookbackMs?: number;
}): NutrientEvidenceSummary {
  const now = params.now ?? Date.now();
  const lookbackMs = params.lookbackMs ?? 30 * 24 * 60 * 60 * 1000;
  const sample = params.latestSample;
  const missing: string[] = [];

  const reading = (key: 'nitrogenPpm' | 'phosphorusPpm' | 'potassiumPpm', label: 'nitrogen' | 'phosphorus' | 'potassium', status: (ppm: number) => NutrientStatus): NutrientReading | null => {
    const value = sample?.measurements[key];
    if (value === undefined || !sample) {
      missing.push(label);
      return null;
    }
    return { value, status: status(value), sampleId: sample.id };
  };

  return {
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    nitrogen: reading('nitrogenPpm', 'nitrogen', nitrogenStatus),
    phosphorus: reading('phosphorusPpm', 'phosphorus', phosphorusStatus),
    potassium: reading('potassiumPpm', 'potassium', potassiumStatus),
    missing,
    trend: {
      'soil.nitrogen': trendDirection(params.observations, params.fieldId, NUTRIENT_TYPE.nitrogen, now - lookbackMs, now),
      'soil.phosphorus': trendDirection(params.observations, params.fieldId, NUTRIENT_TYPE.phosphorus, now - lookbackMs, now),
      'soil.potassium': trendDirection(params.observations, params.fieldId, NUTRIENT_TYPE.potassium, now - lookbackMs, now)
    },
    computedAt: now
  };
}
