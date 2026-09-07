import type { DailyWeatherRecord } from './DailyWeatherRecord';

/**
 * Deterministic summaries and one standard agricultural indicator computed
 * directly from real DailyWeatherRecords — never interpolated. A day with a
 * missing field is excluded from that field's aggregate and counted in
 * `missingDays`/`missingTempDays`, not treated as zero.
 */
export interface WeatherWindowSummary {
  windowDays: number;
  tMaxAvgC: number | null;
  tMinAvgC: number | null;
  precipitationTotalMm: number | null;
  missingTempDays: number;
  missingPrecipDays: number;
}

export function summarizeWeatherWindow(records: DailyWeatherRecord[]): WeatherWindowSummary {
  const tMaxValues = records.map((r) => r.tMaxC).filter((v): v is number => v !== null);
  const tMinValues = records.map((r) => r.tMinC).filter((v): v is number => v !== null);
  const precipValues = records.map((r) => r.precipitationMm).filter((v): v is number => v !== null);

  return {
    windowDays: records.length,
    tMaxAvgC: tMaxValues.length > 0 ? tMaxValues.reduce((a, b) => a + b, 0) / tMaxValues.length : null,
    tMinAvgC: tMinValues.length > 0 ? tMinValues.reduce((a, b) => a + b, 0) / tMinValues.length : null,
    precipitationTotalMm: precipValues.length > 0 ? precipValues.reduce((a, b) => a + b, 0) : null,
    missingTempDays: records.filter((r) => r.tMaxC === null || r.tMinC === null).length,
    missingPrecipDays: records.filter((r) => r.precipitationMm === null).length
  };
}

export interface GrowingDegreeDaysResult {
  baseTempC: number;
  totalGdd: number;
  daysUsed: number;
  daysSkippedMissingData: number;
  method: string;
}

/**
 * Standard Growing Degree Days: sum over days of max(0, (tMax+tMin)/2 - base).
 * A textbook agronomic formula, not a prediction — a day missing tMax or
 * tMin is skipped and counted, never assumed. `baseTempC` must be supplied
 * by the caller (it is crop-specific — e.g. 10°C is a common maize base —
 * this module has no opinion on which crop is planted).
 */
export function growingDegreeDays(records: DailyWeatherRecord[], baseTempC: number): GrowingDegreeDaysResult {
  let totalGdd = 0;
  let daysUsed = 0;
  let daysSkipped = 0;

  for (const record of records) {
    if (record.tMaxC === null || record.tMinC === null) {
      daysSkipped += 1;
      continue;
    }
    totalGdd += Math.max(0, (record.tMaxC + record.tMinC) / 2 - baseTempC);
    daysUsed += 1;
  }

  return {
    baseTempC,
    totalGdd,
    daysUsed,
    daysSkippedMissingData: daysSkipped,
    method: `sum(max(0, (tMax+tMin)/2 - ${baseTempC})) over ${daysUsed} day(s) with complete temperature data`
  };
}
