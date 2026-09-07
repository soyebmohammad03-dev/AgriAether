import { WeatherProviderError } from './WeatherProvider';
import { normalizeOpenMeteoDaily } from './normalizeOpenMeteoDaily';
import type { DailyWeatherRecord } from './DailyWeatherRecord';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,precipitation_sum';
const REQUEST_TIMEOUT_MS = 8000;

/**
 * A second, genuinely distinct Open-Meteo dataset from the same
 * keyless/CORS-safe provider already integrated for current conditions
 * (OpenMeteoProvider.ts) — daily historical aggregates via the forecast
 * endpoint's `past_days` parameter, rather than a live single-instant
 * reading. Real external data (provenance EXTERNAL), not a fixture: this
 * is the "first genuine external dataset integration" for this milestone,
 * deliberately reusing the provider already vetted for having no API key
 * (see OpenMeteoProvider's own doc comment) instead of adding a new,
 * unvetted third-party source.
 */
export class OpenMeteoHistoricalProvider {
  readonly id = 'open-meteo-historical';

  constructor(private readonly fetchFn: typeof fetch = fetch.bind(globalThis)) {}

  /** `days` is how many past days (including today) to request — Open-Meteo's `past_days` parameter, capped by the caller. */
  async fetchDailyHistory(location: { lat: number; lon: number }, days: number): Promise<DailyWeatherRecord[]> {
    const url = `${BASE_URL}?latitude=${location.lat}&longitude=${location.lon}&daily=${DAILY_FIELDS}&past_days=${days}&forecast_days=1&timezone=UTC`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WeatherProviderError(`Open-Meteo historical request timed out after ${REQUEST_TIMEOUT_MS}ms`, 'TIMEOUT');
      }
      throw new WeatherProviderError(`Open-Meteo historical request failed: ${(error as Error).message}`, 'NETWORK');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new WeatherProviderError(`Open-Meteo historical responded with HTTP ${response.status}`, 'HTTP');
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new WeatherProviderError('Open-Meteo historical response was not valid JSON', 'MALFORMED_RESPONSE');
    }

    return normalizeOpenMeteoDaily(json, location, this.id, Date.now());
  }
}
