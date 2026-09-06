import { createId } from '../domain/id';
import type { Observation, ObservationContext } from '../observation/Observation';
import { assertValidObservation } from '../observation/Observation';
import type { WeatherObservation } from './WeatherObservation';

const FIELDS: Array<{ key: keyof WeatherObservation; type: string; unit: string }> = [
  { key: 'airTemperatureC', type: 'weather.air_temperature', unit: 'degC' },
  { key: 'relativeHumidityPercent', type: 'weather.relative_humidity', unit: 'percent' },
  { key: 'pressureHpa', type: 'weather.pressure', unit: 'hPa' },
  { key: 'windSpeedMs', type: 'weather.wind_speed', unit: 'm/s' },
  { key: 'windDirectionDeg', type: 'weather.wind_direction', unit: 'deg' },
  { key: 'precipitationMm', type: 'weather.precipitation', unit: 'mm' },
  { key: 'cloudCoverPercent', type: 'weather.cloud_cover', unit: 'percent' }
];

/**
 * Explodes one WeatherObservation into the canonical per-quantity
 * Observation records the rest of the app (persistence, the Inspector)
 * already knows how to handle — the same "canonical Observation" shape
 * drone telemetry produces, so weather doesn't need its own storage or
 * display path. Every record's provenance is EXTERNAL and its source names
 * the provider, never a sensor — see Observation's own validation, which
 * would reject provenance EXTERNAL from anything that looked like a
 * simulation source.
 */
export function weatherObservationToObservations(
  weather: WeatherObservation,
  context: ObservationContext = {}
): Observation<number>[] {
  const observations: Observation<number>[] = [];

  for (const { key, type, unit } of FIELDS) {
    const value = weather[key];
    if (typeof value !== 'number') continue;

    const obs: Observation<number> = {
      id: createId(`obs_${type}`),
      type,
      value,
      unit,
      timestamp: weather.observedAt,
      location: { frame: 'geodetic', crs: weather.location.crs, lat: weather.location.lat, lon: weather.location.lon },
      source: `external:${weather.provider}`,
      provenance: 'EXTERNAL',
      confidence: weather.freshness === 'FRESH' ? null : 0.5, // stale/cached data is still that provider's value, just aging — flagged via lower confidence rather than hidden
      status: 'OK',
      metadata: { freshness: weather.freshness, retrievedAt: weather.retrievedAt },
      ...context
    };
    assertValidObservation(obs);
    observations.push(obs);
  }

  return observations;
}
