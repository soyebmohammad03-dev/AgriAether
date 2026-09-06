import { describe, expect, it } from 'vitest';
import { WeatherService } from './WeatherService';
import { InMemoryRepository } from '../persistence/InMemoryRepository';
import type { WeatherCacheEntry } from './WeatherCacheEntry';
import type { WeatherProvider } from './WeatherProvider';
import type { WeatherObservation } from './WeatherObservation';

const LOCATION = { lat: 0, lon: 0 };

function fakeObservation(overrides: Partial<WeatherObservation> = {}): WeatherObservation {
  return {
    id: 'w1',
    location: { crs: 'EPSG:4326', ...LOCATION },
    observedAt: 0,
    retrievedAt: 0,
    provider: 'fake',
    airTemperatureC: 20,
    relativeHumidityPercent: 50,
    pressureHpa: 1013,
    windSpeedMs: 1,
    windDirectionDeg: 0,
    precipitationMm: 0,
    cloudCoverPercent: 0,
    provenance: 'EXTERNAL',
    freshness: 'FRESH',
    raw: null,
    ...overrides
  };
}

class CountingProvider implements WeatherProvider {
  readonly id = 'fake';
  calls = 0;
  shouldFail = false;

  async fetchCurrent(): Promise<WeatherObservation> {
    this.calls += 1;
    if (this.shouldFail) throw new Error('provider down');
    return fakeObservation();
  }
}

describe('WeatherService', () => {
  it('calls the provider on a cold cache and caches the result', async () => {
    const provider = new CountingProvider();
    const cache = new InMemoryRepository<WeatherCacheEntry>();
    const service = new WeatherService(provider, cache);

    const result = await service.getCurrentWeather(LOCATION);
    expect(result?.freshness).toBe('FRESH');
    expect(provider.calls).toBe(1);
    expect(await cache.list()).toHaveLength(1);
  });

  it('serves from cache without calling the provider again within the fresh TTL', async () => {
    const provider = new CountingProvider();
    const cache = new InMemoryRepository<WeatherCacheEntry>();
    let now = 0;
    const service = new WeatherService(provider, cache, () => now);

    await service.getCurrentWeather(LOCATION);
    now += 60_000; // 1 minute later, well within the 15-minute TTL
    const second = await service.getCurrentWeather(LOCATION);

    expect(provider.calls).toBe(1);
    expect(second?.freshness).toBe('FRESH');
  });

  it('falls back to a CACHED reading when the provider fails after the TTL expires', async () => {
    const provider = new CountingProvider();
    const cache = new InMemoryRepository<WeatherCacheEntry>();
    let now = 0;
    const service = new WeatherService(provider, cache, () => now);

    await service.getCurrentWeather(LOCATION);
    now += 20 * 60 * 1000; // past the 15-minute TTL
    provider.shouldFail = true;
    const result = await service.getCurrentWeather(LOCATION);

    expect(result?.freshness).toBe('CACHED');
    expect(result?.observation.airTemperatureC).toBe(20);
  });

  it('marks a very old cache entry STALE rather than presenting it as current', async () => {
    const provider = new CountingProvider();
    const cache = new InMemoryRepository<WeatherCacheEntry>();
    let now = 0;
    const service = new WeatherService(provider, cache, () => now);

    await service.getCurrentWeather(LOCATION);
    now += 25 * 60 * 60 * 1000; // past the 24h staleness ceiling
    provider.shouldFail = true;
    const result = await service.getCurrentWeather(LOCATION);

    expect(result?.freshness).toBe('STALE');
  });

  it('returns null (never a fabricated reading) when the provider fails and there is no cache at all', async () => {
    const provider = new CountingProvider();
    provider.shouldFail = true;
    const cache = new InMemoryRepository<WeatherCacheEntry>();
    const service = new WeatherService(provider, cache);

    const result = await service.getCurrentWeather(LOCATION);
    expect(result).toBeNull();
  });
});
