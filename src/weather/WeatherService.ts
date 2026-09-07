import type { Repository } from '../persistence/Repository';
import type { WeatherProvider } from './WeatherProvider';
import type { WeatherObservation } from './WeatherObservation';
import { type WeatherCacheEntry, weatherCacheKey } from './WeatherCacheEntry';
import { diagnostics } from '../diagnostics/Diagnostics';

/** A cache entry younger than this is served without calling the provider again. */
const FRESH_TTL_MS = 15 * 60 * 1000;
/** A cache entry older than this is no longer offered even as a fallback — better to say "unavailable" than show hours-old weather as current. */
const STALE_CEILING_MS = 24 * 60 * 60 * 1000;

export interface WeatherResult {
  observation: WeatherObservation;
  freshness: 'FRESH' | 'CACHED' | 'STALE';
}

/**
 * Sits between the app and a WeatherProvider: serves a fresh cached reading
 * without a network call, falls back to a cache entry (marked CACHED or
 * STALE) if the provider fails, and never lets the render loop or the rest
 * of the app crash because weather is unreachable — it returns `null`
 * instead, which the UI must render as "unavailable," never as invented
 * weather.
 */
export class WeatherService {
  constructor(
    private readonly provider: WeatherProvider,
    private readonly cache: Repository<WeatherCacheEntry>,
    private readonly now: () => number = Date.now
  ) {}

  async getCurrentWeather(location: { lat: number; lon: number }): Promise<WeatherResult | null> {
    const key = weatherCacheKey(this.provider.id, location);
    const cached = await this.cache.getById(key);
    const cacheAge = cached ? this.now() - cached.cachedAt : Infinity;

    if (cached && cacheAge < FRESH_TTL_MS) {
      return { observation: { ...cached.observation, freshness: 'FRESH' }, freshness: 'FRESH' };
    }

    try {
      const fresh = await this.provider.fetchCurrent(location);
      await this.cache.save({ id: key, observation: fresh, cachedAt: this.now() } satisfies WeatherCacheEntry);
      return { observation: fresh, freshness: 'FRESH' };
    } catch (error) {
      diagnostics.log({
        severity: cached ? 'WARN' : 'ERROR',
        category: 'EXTERNAL_DATA',
        operation: 'WeatherService.getCurrentWeather',
        message: cached ? 'Weather provider request failed — falling back to cached reading.' : 'Weather provider request failed with no cache to fall back to.',
        detail: { providerId: this.provider.id, message: (error as Error).message ?? null }
      });
      if (!cached) return null;
      // Past the staleness ceiling, still returned (offline-first: something is better than nothing) but never silently as current.
      const freshness = cacheAge < STALE_CEILING_MS ? 'CACHED' : 'STALE';
      return { observation: { ...cached.observation, freshness }, freshness };
    }
  }
}
