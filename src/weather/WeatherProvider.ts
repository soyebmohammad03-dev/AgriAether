import type { WeatherObservation } from './WeatherObservation';

/**
 * The one contract the application depends on for weather. Nothing outside
 * this module and its implementations should know which real provider (if
 * any) is behind it — the same shape a RealWeatherProvider, a
 * MockWeatherProvider (deterministic, for tests), or a future second real
 * provider all implement.
 */
export interface WeatherProvider {
  readonly id: string;
  fetchCurrent(location: { lat: number; lon: number }): Promise<WeatherObservation>;
}

export class WeatherProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'MALFORMED_RESPONSE'
  ) {
    super(message);
    this.name = 'WeatherProviderError';
  }
}
