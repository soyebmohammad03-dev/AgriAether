import { createId } from '../domain/id';
import type { Observation, ObservationContext } from '../observation/Observation';
import { assertValidObservation } from '../observation/Observation';
import type { DailyWeatherRecord } from './DailyWeatherRecord';

const FIELDS: Array<{ key: 'tMaxC' | 'tMinC' | 'precipitationMm'; type: string; unit: string }> = [
  { key: 'tMaxC', type: 'weather.daily_temp_max', unit: 'degC' },
  { key: 'tMinC', type: 'weather.daily_temp_min', unit: 'degC' },
  { key: 'precipitationMm', type: 'weather.daily_precipitation', unit: 'mm' }
];

/** Same pattern as weatherObservationToObservations.ts — explodes one daily record into the canonical per-quantity Observation shape, timestamped at that date's UTC midnight. */
export function dailyWeatherRecordToObservations(record: DailyWeatherRecord, context: ObservationContext = {}): Observation<number>[] {
  const observations: Observation<number>[] = [];
  const timestamp = Date.parse(`${record.date}T00:00:00Z`);

  for (const { key, type, unit } of FIELDS) {
    const value = record[key];
    if (typeof value !== 'number') continue;

    const obs: Observation<number> = {
      id: createId(`obs_${type}`),
      type,
      value,
      unit,
      timestamp,
      location: { frame: 'geodetic', crs: record.location.crs, lat: record.location.lat, lon: record.location.lon },
      source: `external:${record.provider}`,
      provenance: 'EXTERNAL',
      confidence: null,
      status: 'OK',
      metadata: { date: record.date },
      ...context
    };
    assertValidObservation(obs);
    observations.push(obs);
  }

  return observations;
}
