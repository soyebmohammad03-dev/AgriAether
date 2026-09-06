import { createId } from '../domain/id';
import { WeatherProviderError } from './WeatherProvider';
import { assertValidWeatherObservation, type WeatherObservation } from './WeatherObservation';

/** The subset of Open-Meteo's `/v1/forecast?current=...` response shape this module reads. Anything else in the payload is ignored, not assumed absent. */
export interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    pressure_msl?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    precipitation?: number;
    cloud_cover?: number;
  };
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Raw provider JSON -> canonical WeatherObservation. Throws WeatherProviderError('MALFORMED_RESPONSE') on a shape this module can't make sense of. */
export function normalizeOpenMeteoResponse(
  raw: unknown,
  requestedLocation: { lat: number; lon: number },
  retrievedAt: number
): WeatherObservation {
  const response = raw as Partial<OpenMeteoCurrentResponse>;
  if (!response || typeof response !== 'object' || !response.current || typeof response.current.time !== 'string') {
    throw new WeatherProviderError('Open-Meteo response is missing the expected "current" block', 'MALFORMED_RESPONSE');
  }

  const observedAt = Date.parse(response.current.time + 'Z'); // Open-Meteo returns UTC time without a zone suffix
  if (!Number.isFinite(observedAt)) {
    throw new WeatherProviderError(`Open-Meteo response has an unparseable current.time: "${response.current.time}"`, 'MALFORMED_RESPONSE');
  }

  const observation: WeatherObservation = {
    id: createId('weather'),
    location: { crs: 'EPSG:4326', lat: requestedLocation.lat, lon: requestedLocation.lon },
    observedAt,
    retrievedAt,
    provider: 'open-meteo',
    airTemperatureC: numberOrNull(response.current.temperature_2m),
    relativeHumidityPercent: numberOrNull(response.current.relative_humidity_2m),
    pressureHpa: numberOrNull(response.current.pressure_msl),
    windSpeedMs: numberOrNull(response.current.wind_speed_10m),
    windDirectionDeg: numberOrNull(response.current.wind_direction_10m),
    precipitationMm: numberOrNull(response.current.precipitation),
    cloudCoverPercent: numberOrNull(response.current.cloud_cover),
    provenance: 'EXTERNAL',
    freshness: 'FRESH',
    raw: raw as Record<string, unknown>
  };

  assertValidWeatherObservation(observation);
  return observation;
}
