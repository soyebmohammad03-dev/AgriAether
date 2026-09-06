import { WeatherProviderError, type WeatherProvider } from './WeatherProvider';
import { normalizeOpenMeteoResponse } from './normalizeOpenMeteo';
import type { WeatherObservation } from './WeatherObservation';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_FIELDS = 'temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover';
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Real weather provider backed by Open-Meteo (https://open-meteo.com).
 *
 * Chosen deliberately over providers like OpenWeatherMap or Tomorrow.io
 * BECAUSE it requires no API key: its free tier is keyless, CC-BY licensed,
 * has no published rate limit for non-commercial use at this volume, and
 * returns current + forecast + historical data over plain HTTPS/JSON. That
 * sidesteps Part 24's security concern entirely — there is no secret for
 * this frontend-only app to leak. If a future provider requires a real
 * secret key, it cannot be called directly from this codebase as it stands
 * today; see the README's Security section for why a backend proxy would
 * be required first.
 */
export class OpenMeteoProvider implements WeatherProvider {
  readonly id = 'open-meteo';

  // Bind is required: `this.fetchFn(url)` calls fetch with `this` set to the
  // OpenMeteoProvider instance rather than `window`/`globalThis`, which
  // makes Chrome throw "Failed to execute 'fetch': Illegal invocation."
  constructor(private readonly fetchFn: typeof fetch = fetch.bind(globalThis)) {}

  async fetchCurrent(location: { lat: number; lon: number }): Promise<WeatherObservation> {
    const url = `${BASE_URL}?latitude=${location.lat}&longitude=${location.lon}&current=${CURRENT_FIELDS}&timezone=UTC`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WeatherProviderError(`Open-Meteo request timed out after ${REQUEST_TIMEOUT_MS}ms`, 'TIMEOUT');
      }
      throw new WeatherProviderError(`Open-Meteo request failed: ${(error as Error).message}`, 'NETWORK');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new WeatherProviderError(`Open-Meteo responded with HTTP ${response.status}`, 'HTTP');
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new WeatherProviderError('Open-Meteo response was not valid JSON', 'MALFORMED_RESPONSE');
    }

    return normalizeOpenMeteoResponse(json, location, Date.now());
  }
}
