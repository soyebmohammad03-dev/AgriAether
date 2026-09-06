import { describe, expect, it } from 'vitest';
import { assertValidWeatherObservation, type WeatherObservation } from './WeatherObservation';

function baseObservation(overrides: Partial<WeatherObservation> = {}): WeatherObservation {
  return {
    id: 'w1',
    location: { crs: 'EPSG:4326', lat: 0, lon: 0 },
    observedAt: Date.now(),
    retrievedAt: Date.now(),
    provider: 'open-meteo',
    airTemperatureC: 20,
    relativeHumidityPercent: 55,
    pressureHpa: 1013,
    windSpeedMs: 3,
    windDirectionDeg: 180,
    precipitationMm: 0,
    cloudCoverPercent: 40,
    provenance: 'EXTERNAL',
    freshness: 'FRESH',
    raw: null,
    ...overrides
  };
}

describe('assertValidWeatherObservation', () => {
  it('accepts a well-formed reading', () => {
    expect(() => assertValidWeatherObservation(baseObservation())).not.toThrow();
  });

  it('accepts legitimate extreme weather', () => {
    expect(() => assertValidWeatherObservation(baseObservation({ airTemperatureC: -60, windSpeedMs: 55 }))).not.toThrow();
  });

  it('rejects an impossible humidity value', () => {
    expect(() => assertValidWeatherObservation(baseObservation({ relativeHumidityPercent: 140 }))).toThrow(/relativeHumidityPercent/);
  });

  it('rejects a negative wind speed', () => {
    expect(() => assertValidWeatherObservation(baseObservation({ windSpeedMs: -5 }))).toThrow(/windSpeedMs/);
  });

  it('rejects a missing provider', () => {
    expect(() => assertValidWeatherObservation(baseObservation({ provider: '' }))).toThrow(/provider/);
  });

  it('rejects a missing observedAt', () => {
    expect(() => assertValidWeatherObservation(baseObservation({ observedAt: NaN }))).toThrow(/observedAt/);
  });
});
