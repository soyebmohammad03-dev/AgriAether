/**
 * One day's aggregated weather from a historical archive — distinct from
 * WeatherObservation (a single instantaneous reading). `date` is the
 * provider's local calendar date (YYYY-MM-DD), not a timestamp, because
 * daily aggregates don't have a single instant they occurred at.
 */
export interface DailyWeatherRecord {
  id: string;
  location: { crs: 'EPSG:4326'; lat: number; lon: number };
  date: string;
  tMaxC: number | null;
  tMinC: number | null;
  precipitationMm: number | null;
  provider: string;
  retrievedAt: number;
  provenance: 'EXTERNAL';
}

const PLAUSIBLE_TEMP_C: [number, number] = [-90, 60];
const PLAUSIBLE_PRECIP_MM: [number, number] = [0, 500];

export function assertValidDailyWeatherRecord(record: DailyWeatherRecord): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    throw new Error(`DailyWeatherRecord has an invalid date "${record.date}" — expected YYYY-MM-DD`);
  }
  if (!record.provider) {
    throw new Error('DailyWeatherRecord is missing a provider id');
  }
  if (record.tMaxC !== null && (!Number.isFinite(record.tMaxC) || record.tMaxC < PLAUSIBLE_TEMP_C[0] || record.tMaxC > PLAUSIBLE_TEMP_C[1])) {
    throw new Error(`DailyWeatherRecord.tMaxC = ${record.tMaxC} is outside the plausible range`);
  }
  if (record.tMinC !== null && (!Number.isFinite(record.tMinC) || record.tMinC < PLAUSIBLE_TEMP_C[0] || record.tMinC > PLAUSIBLE_TEMP_C[1])) {
    throw new Error(`DailyWeatherRecord.tMinC = ${record.tMinC} is outside the plausible range`);
  }
  if (record.tMaxC !== null && record.tMinC !== null && record.tMaxC < record.tMinC) {
    throw new Error(`DailyWeatherRecord for ${record.date} has tMaxC (${record.tMaxC}) below tMinC (${record.tMinC})`);
  }
  if (record.precipitationMm !== null && (!Number.isFinite(record.precipitationMm) || record.precipitationMm < PLAUSIBLE_PRECIP_MM[0] || record.precipitationMm > PLAUSIBLE_PRECIP_MM[1])) {
    throw new Error(`DailyWeatherRecord.precipitationMm = ${record.precipitationMm} is outside the plausible range`);
  }
}

export function createDailyWeatherRecord(params: {
  location: { lat: number; lon: number };
  date: string;
  tMaxC: number | null;
  tMinC: number | null;
  precipitationMm: number | null;
  provider: string;
  retrievedAt: number;
}): DailyWeatherRecord {
  const record: DailyWeatherRecord = {
    // Deterministic (not domain/id.ts's random createId) so re-fetching the same provider/location/date
    // overwrites the same record instead of accumulating duplicates on every refresh — see WorldRegistry.recordDailyWeather.
    id: `daily_weather_${params.provider}_${params.date}_${params.location.lat.toFixed(4)}_${params.location.lon.toFixed(4)}`,
    location: { crs: 'EPSG:4326', lat: params.location.lat, lon: params.location.lon },
    date: params.date,
    tMaxC: params.tMaxC,
    tMinC: params.tMinC,
    precipitationMm: params.precipitationMm,
    provider: params.provider,
    retrievedAt: params.retrievedAt,
    provenance: 'EXTERNAL'
  };
  assertValidDailyWeatherRecord(record);
  return record;
}
