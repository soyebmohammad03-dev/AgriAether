import type { MoistureStatus } from '../soil/SoilQuality';
import type { AgriculturalEvent } from '../domain/AgriculturalEvent';
import type { Observation } from '../observation/Observation';
import { trendDirection, type TrendResult } from '../temporal/TemporalIntelligence';

export type IrrigationNeedStatus = 'LIKELY_NEEDED' | 'NOT_INDICATED' | 'INSUFFICIENT_DATA';

export interface IrrigationAssessment {
  fieldId: string;
  zoneId: string | null;
  moistureStatus: MoistureStatus | null;
  moistureSampleId: string | null;
  moistureTrend: TrendResult | null;
  /** Total precipitation (mm) over the recent weather window — a real rainfall context, not a demand forecast. */
  recentRainfallMm: number | null;
  recentIrrigationEvents: Array<{ id: string; timestamp: number }>;
  needStatus: IrrigationNeedStatus;
  reasons: string[];
  /** Evidence categories not supplied — the honest complement to `reasons`. */
  missingEvidence: string[];
  computedAt: number;
  method: string;
}

/** Below this, a recent irrigation/rainfall event is no longer considered "recent" for need assessment. */
const RECENT_EVENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
/** Below this window total, rainfall is not considered to have materially relieved a moisture deficit. */
const MEANINGFUL_RAINFALL_MM = 5;

/**
 * A conservative, evidence-oriented irrigation-need screen. Never computes a
 * water volume, litres/hectare, or duration — those require a calibrated
 * evapotranspiration/crop-coefficient model this repository doesn't have
 * (see ModelRegistry's IRRIGATION_DEMAND entry). `needStatus` is
 * INSUFFICIENT_DATA whenever no soil-moisture evidence exists at all.
 */
export function assessIrrigationNeed(params: {
  fieldId: string;
  zoneId?: string | null;
  moistureStatus: MoistureStatus | null;
  moistureSampleId?: string | null;
  observations: ReadonlyArray<Observation<number>>;
  recentRainfallMm: number | null;
  recentEvents: AgriculturalEvent[];
  now?: number;
  lookbackMs?: number;
}): IrrigationAssessment {
  const now = params.now ?? Date.now();
  const lookbackMs = params.lookbackMs ?? 7 * 24 * 60 * 60 * 1000;
  const reasons: string[] = [];
  const missingEvidence: string[] = [];

  const moistureTrend = trendDirection(params.observations, params.fieldId, 'soil.moisture', now - lookbackMs, now);

  const recentIrrigationEvents = params.recentEvents
    .filter((e) => e.fieldId === params.fieldId && e.type === 'IRRIGATION' && now - e.timestamp <= RECENT_EVENT_WINDOW_MS)
    .map((e) => ({ id: e.id, timestamp: e.timestamp }));

  if (params.recentRainfallMm === null || params.recentRainfallMm === undefined) {
    missingEvidence.push('recent_rainfall');
  }

  let needStatus: IrrigationNeedStatus;
  if (params.moistureStatus === null || params.moistureStatus === undefined) {
    missingEvidence.push('soil_moisture');
    needStatus = 'INSUFFICIENT_DATA';
  } else if (params.moistureStatus === 'SATURATED') {
    reasons.push('Most recent soil sample classifies as SATURATED — irrigation is not indicated, and continued watering risks waterlogging.');
    needStatus = 'NOT_INDICATED';
  } else if (params.moistureStatus === 'DRY') {
    const recentlyIrrigated = recentIrrigationEvents.length > 0;
    const recentlyRained = (params.recentRainfallMm ?? 0) >= MEANINGFUL_RAINFALL_MM;
    if (recentlyIrrigated) {
      reasons.push('Soil moisture is DRY, but an irrigation event was already logged within the last 3 days — allow it to take effect before re-assessing.');
      needStatus = 'NOT_INDICATED';
    } else if (recentlyRained) {
      reasons.push(`Soil moisture is DRY, but ${(params.recentRainfallMm ?? 0).toFixed(1)}mm of rainfall fell in the recent window — re-check soil moisture before irrigating.`);
      needStatus = 'NOT_INDICATED';
    } else {
      reasons.push('Most recent soil sample classifies as DRY with no recent irrigation event or meaningful rainfall.');
      needStatus = 'LIKELY_NEEDED';
    }
  } else {
    needStatus = 'NOT_INDICATED';
  }

  return {
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    moistureStatus: params.moistureStatus ?? null,
    moistureSampleId: params.moistureSampleId ?? null,
    moistureTrend,
    recentRainfallMm: params.recentRainfallMm ?? null,
    recentIrrigationEvents,
    needStatus,
    reasons,
    missingEvidence,
    computedAt: now,
    method: 'rule_based_moisture_rainfall_screening_v1'
  };
}
