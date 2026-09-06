import { describe, expect, it } from 'vitest';
import { weatherObservationToObservations } from './weatherObservationToObservations';
import type { WeatherObservation } from './WeatherObservation';

function fakeWeather(overrides: Partial<WeatherObservation> = {}): WeatherObservation {
  return {
    id: 'w1',
    location: { crs: 'EPSG:4326', lat: 0, lon: 0 },
    observedAt: 1000,
    retrievedAt: 2000,
    provider: 'open-meteo',
    airTemperatureC: 25,
    relativeHumidityPercent: 60,
    pressureHpa: 1010,
    windSpeedMs: 2,
    windDirectionDeg: 90,
    precipitationMm: null,
    cloudCoverPercent: null,
    provenance: 'EXTERNAL',
    freshness: 'FRESH',
    raw: null,
    ...overrides
  };
}

describe('weatherObservationToObservations', () => {
  it('produces one Observation per non-null field', () => {
    const observations = weatherObservationToObservations(fakeWeather());
    expect(observations.map((o) => o.type).sort()).toEqual(
      ['weather.air_temperature', 'weather.pressure', 'weather.relative_humidity', 'weather.wind_direction', 'weather.wind_speed'].sort()
    );
  });

  it('every observation is provenance EXTERNAL, sourced from the provider, never MEASURED and never a sensor', () => {
    const observations = weatherObservationToObservations(fakeWeather());
    for (const obs of observations) {
      expect(obs.provenance).toBe('EXTERNAL');
      expect(obs.source).toBe('external:open-meteo');
      expect(obs.sensorId ?? null).toBeNull();
    }
  });

  it('uses the weather observedAt as the timestamp, not retrievedAt', () => {
    const observations = weatherObservationToObservations(fakeWeather());
    expect(observations.every((o) => o.timestamp === 1000)).toBe(true);
  });

  it('carries provided domain context through', () => {
    const observations = weatherObservationToObservations(fakeWeather(), { farmId: 'farm_1', fieldId: 'field_1' });
    expect(observations.every((o) => o.farmId === 'farm_1' && o.fieldId === 'field_1')).toBe(true);
  });

  it('lowers confidence for stale/cached readings without hiding them', () => {
    const fresh = weatherObservationToObservations(fakeWeather({ freshness: 'FRESH' }));
    const stale = weatherObservationToObservations(fakeWeather({ freshness: 'STALE' }));
    expect(fresh[0].confidence).toBeNull();
    expect(stale[0].confidence).toBe(0.5);
  });
});
