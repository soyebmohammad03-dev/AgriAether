import { WeatherProviderError } from './WeatherProvider';
import { createDailyWeatherRecord, type DailyWeatherRecord } from './DailyWeatherRecord';

/** The subset of Open-Meteo's `daily=` response shape this module reads. */
export interface OpenMeteoDailyResponse {
  latitude: number;
  longitude: number;
  daily?: {
    time: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

function valueOrNull(arr: (number | null)[] | undefined, i: number): number | null {
  const v = arr?.[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Raw provider JSON -> canonical DailyWeatherRecord[]. Throws WeatherProviderError('MALFORMED_RESPONSE') on a shape this module can't make sense of. A day with all-null fields is still included — a real "no data reported" day, not silently dropped. */
export function normalizeOpenMeteoDaily(raw: unknown, requestedLocation: { lat: number; lon: number }, provider: string, retrievedAt: number): DailyWeatherRecord[] {
  const response = raw as Partial<OpenMeteoDailyResponse>;
  if (!response || typeof response !== 'object' || !response.daily || !Array.isArray(response.daily.time)) {
    throw new WeatherProviderError('Open-Meteo daily response is missing the expected "daily" block', 'MALFORMED_RESPONSE');
  }

  return response.daily.time.map((date, i) =>
    createDailyWeatherRecord({
      location: requestedLocation,
      date,
      tMaxC: valueOrNull(response.daily!.temperature_2m_max, i),
      tMinC: valueOrNull(response.daily!.temperature_2m_min, i),
      precipitationMm: valueOrNull(response.daily!.precipitation_sum, i),
      provider,
      retrievedAt
    })
  );
}
