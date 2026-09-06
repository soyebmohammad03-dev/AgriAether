import type { DatasetRecord } from './Dataset';

/**
 * The external-dataset equivalent of weather/WeatherProvider.ts — the
 * application depends on this interface, never a specific provider. No
 * live network-based implementation exists yet (Phase 5 didn't add one —
 * see the README for why); `FixtureDatasetProvider` below is the only
 * implementation, returning deterministic local data for tests and the
 * demo world. A real implementation (e.g. a public agricultural-imagery
 * catalog) would implement the same three methods and reuse the same
 * timeout/error-handling pattern OpenMeteoProvider already established.
 */
export interface DatasetProvider {
  readonly id: string;
  /** Lists what's available without fetching payloads. */
  discover(): Promise<DatasetRecord[]>;
  /** Fetches one dataset's raw payload — shape depends on dataset.type (GeoJSON for VECTOR, a raster grid descriptor for RASTER, etc). */
  fetch(datasetId: string): Promise<unknown>;
}

export class DatasetProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: 'NOT_FOUND' | 'FETCH_FAILED' | 'INVALID_PAYLOAD'
  ) {
    super(message);
    this.name = 'DatasetProviderError';
  }
}
