/**
 * A normalized weather reading from an external provider — the "canonical
 * Observation" step of the ingestion pipeline (see README) for weather
 * specifically, before it's exploded into generic Observation records for
 * storage (see weatherObservationToObservations.ts).
 *
 * `observedAt` (when the weather actually occurred, per the provider) and
 * `retrievedAt` (when this application fetched it) are deliberately
 * distinct — conflating them would hide latency and make cached/stale data
 * look fresher than it is.
 */
export interface WeatherObservation {
  id: string;
  /** Always geodetic — weather is real-world context, never expressed in the simulation's local frame. */
  location: { crs: 'EPSG:4326'; lat: number; lon: number };
  observedAt: number;
  retrievedAt: number;
  /** Identifies the provider, e.g. "open-meteo". Never a sensor id — weather is not drone telemetry. */
  provider: string;
  airTemperatureC: number | null;
  relativeHumidityPercent: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  precipitationMm: number | null;
  cloudCoverPercent: number | null;
  /** Always EXTERNAL — see observation/Observation.ts's Provenance type, reused rather than duplicated. */
  provenance: 'EXTERNAL';
  freshness: 'FRESH' | 'CACHED' | 'STALE';
  /** The provider's raw response, kept for traceability — never read by application logic, only for debugging/audit. */
  raw: Record<string, unknown> | null;
}

const PLAUSIBLE_RANGES = {
  airTemperatureC: [-90, 60], // coldest/hottest ever recorded on Earth, generously bounded
  relativeHumidityPercent: [0, 100],
  pressureHpa: [800, 1100],
  windSpeedMs: [0, 120], // strongest recorded surface wind gusts are ~110 m/s
  windDirectionDeg: [0, 360],
  precipitationMm: [0, 500], // per reporting interval — extreme but not impossible
  cloudCoverPercent: [0, 100]
} as const;

/**
 * Rejects malformed data (wrong units, impossible values, NaN) without
 * rejecting legitimate extreme weather — the ranges above are generous
 * real-world bounds, not "normal weather" bounds.
 */
export function assertValidWeatherObservation(obs: WeatherObservation): void {
  if (!Number.isFinite(obs.observedAt)) {
    throw new Error('WeatherObservation is missing a valid observedAt timestamp');
  }
  if (!Number.isFinite(obs.retrievedAt)) {
    throw new Error('WeatherObservation is missing a valid retrievedAt timestamp');
  }
  if (!obs.provider) {
    throw new Error('WeatherObservation is missing a provider id');
  }
  for (const [field, [min, max]] of Object.entries(PLAUSIBLE_RANGES)) {
    const value = obs[field as keyof typeof PLAUSIBLE_RANGES];
    if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
      throw new Error(`WeatherObservation.${field} = ${value} is outside the plausible range [${min}, ${max}]`);
    }
  }
}
