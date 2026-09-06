import type { SensorKind } from '../domain/SensorRecord';
import type { Observation } from '../observation/Observation';

export type CoverageCategory = 'rgb' | 'multispectral' | 'thermal' | 'soil' | 'weather';

const CATEGORY_SENSOR_KINDS: Record<CoverageCategory, SensorKind[]> = {
  rgb: ['rgb-camera'],
  multispectral: ['multispectral-camera'],
  thermal: ['thermal-camera'],
  soil: ['soil-moisture', 'soil-temperature', 'soil-ec', 'soil-ph', 'soil-npk'],
  weather: [] // weather comes from the external provider, not a deployed sensor kind — see `weatherAvailable`
};

export interface FieldCoverageReport {
  fieldId: string;
  /** null when no raster has been ingested for this field — never a fabricated percentage. */
  spatialCoveragePercent: number | null;
  sensorCoverage: Record<CoverageCategory, 'available' | 'unavailable'>;
  temporalCoverage: { earliestObservation: number | null; latestObservation: number | null };
  freshnessMs: number | null;
}

/**
 * Computes what's real: which sensor categories are actually deployed
 * (from the WorldRegistry), the observed time range (from real
 * Observations), and — only if a raster was actually clipped for this
 * field — how much of it has valid data. Nothing here is a fabricated
 * percentage; a field with no raster gets `spatialCoveragePercent: null`,
 * not an invented number.
 */
export function computeFieldCoverage(params: {
  fieldId: string;
  availableSensorKinds: readonly SensorKind[];
  observations: ReadonlyArray<Observation<unknown>>;
  weatherAvailable: boolean;
  spatialCoverageFraction?: number | null;
  now?: number;
}): FieldCoverageReport {
  const now = params.now ?? Date.now();
  const sensorCoverage = {} as Record<CoverageCategory, 'available' | 'unavailable'>;
  for (const category of Object.keys(CATEGORY_SENSOR_KINDS) as CoverageCategory[]) {
    if (category === 'weather') {
      sensorCoverage.weather = params.weatherAvailable ? 'available' : 'unavailable';
      continue;
    }
    const kinds = CATEGORY_SENSOR_KINDS[category];
    sensorCoverage[category] = kinds.some((k) => params.availableSensorKinds.includes(k)) ? 'available' : 'unavailable';
  }

  const timestamps = params.observations.map((o) => o.timestamp).filter((t) => Number.isFinite(t));
  const earliestObservation = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const latestObservation = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    fieldId: params.fieldId,
    spatialCoveragePercent: params.spatialCoverageFraction != null ? params.spatialCoverageFraction * 100 : null,
    sensorCoverage,
    temporalCoverage: { earliestObservation, latestObservation },
    freshnessMs: latestObservation !== null ? now - latestObservation : null
  };
}
