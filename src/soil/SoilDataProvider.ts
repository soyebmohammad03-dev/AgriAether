/**
 * The interface a future real soil data source would implement — the same
 * seam weather/WeatherProvider.ts establishes for weather. No implementation
 * is registered by default (see UnconfiguredSoilProvider below): every
 * genuinely free, no-credential soil API surveyed for Phase 6 turned out to
 * be either a gridded weather-model estimate (e.g. reanalysis-derived soil
 * moisture, which is a modeled quantity, not a ground-truth reading) or to
 * require registration/credentials this project doesn't hold. Using a
 * modeled estimate as a stand-in for a physical soil sensor would violate
 * the same rule that already applies to weather-as-soil-data: "do not
 * pretend weather data represents soil measurements." Leaving this
 * unconfigured is the honest choice per the Phase 6 brief, not an
 * oversight — SoilSample.ts's GROUND_SENSOR/LABORATORY/EXTERNAL_DATASET
 * pathways are ready for a real one the moment it's added.
 */
export interface SoilDataProvider {
  readonly id: string;
  fetchCurrent(location: { lat: number; lon: number }): Promise<SoilDataProviderReading>;
}

export interface SoilDataProviderReading {
  moisturePercent: number | null;
  temperatureC: number | null;
  observedAt: number;
}

export class SoilDataProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SoilDataProviderError';
  }
}

/**
 * The only SoilDataProvider registered today. Always rejects — there is no
 * live source behind it — so a caller must handle "soil data unavailable"
 * explicitly rather than receive a value that looks real. See
 * WeatherService.ts for the analogous "provider unreachable" fallback
 * pattern; soil has no cache to fall back to because it has never had a
 * successful fetch.
 */
export class UnconfiguredSoilProvider implements SoilDataProvider {
  readonly id = 'unconfigured';

  async fetchCurrent(_location: { lat: number; lon: number }): Promise<SoilDataProviderReading> {
    throw new SoilDataProviderError(
      'No trustworthy external soil data provider is configured. Ground-truth soil observations require a real sensor or laboratory sample — see soil/SoilSample.ts.'
    );
  }
}
