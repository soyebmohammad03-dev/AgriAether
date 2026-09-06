import type { WeatherObservation } from './WeatherObservation';

/** One cached provider reading, keyed by provider+rounded location so repeated lookups near the same point reuse it. */
export interface WeatherCacheEntry {
  id: string;
  observation: WeatherObservation;
  cachedAt: number;
}

/** Rounds to ~1.1km so nearby requests (e.g. the same field) share one cache entry instead of one per exact coordinate. */
export function weatherCacheKey(provider: string, location: { lat: number; lon: number }): string {
  return `${provider}:${location.lat.toFixed(2)}:${location.lon.toFixed(2)}`;
}
