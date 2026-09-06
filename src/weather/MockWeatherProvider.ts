import { createId } from '../domain/id';
import type { WeatherObservation } from './WeatherObservation';
import type { WeatherProvider } from './WeatherProvider';

/** A deterministic, network-free WeatherProvider for tests and any offline demo mode. Never used as the app's default provider. */
export class MockWeatherProvider implements WeatherProvider {
  readonly id = 'mock';

  constructor(private readonly fixedReading: Partial<WeatherObservation> = {}) {}

  async fetchCurrent(location: { lat: number; lon: number }): Promise<WeatherObservation> {
    const now = Date.now();
    return {
      id: createId('weather'),
      location: { crs: 'EPSG:4326', lat: location.lat, lon: location.lon },
      observedAt: now,
      retrievedAt: now,
      provider: this.id,
      airTemperatureC: 22,
      relativeHumidityPercent: 55,
      pressureHpa: 1013,
      windSpeedMs: 2.5,
      windDirectionDeg: 200,
      precipitationMm: 0,
      cloudCoverPercent: 30,
      provenance: 'EXTERNAL',
      freshness: 'FRESH',
      raw: null,
      ...this.fixedReading
    };
  }
}
