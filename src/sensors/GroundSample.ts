import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { PlausibleRange } from '../sensing/Units';

/**
 * Non-soil ground/fixed-station measurements (Phase 6) — the same pattern
 * as soil/SoilSample.ts, kept as a separate module because these quantities
 * are measured by different sensor kinds (weather-station, rain-gauge,
 * anemometer, leaf-wetness, solar-radiation, irrigation-flow,
 * water-quality — see domain/SensorRecord.ts's SensorKind) and belong to a
 * field/zone rather than a soil depth.
 */
export type GroundSampleMethod = 'GROUND_SENSOR' | 'EXTERNAL_DATASET' | 'SIMULATION';

const METHOD_PROVENANCE: Record<GroundSampleMethod, Provenance> = {
  GROUND_SENSOR: 'MEASURED',
  EXTERNAL_DATASET: 'EXTERNAL',
  SIMULATION: 'SIMULATED'
};

export interface GroundMeasurements {
  airTemperatureC?: number;
  relativeHumidityPercent?: number;
  /** Sensor-reported wetness index normalized to 0-100; the underlying scale (e.g. a 0-15 resistance-grid index) varies by manufacturer and is not itself standardized. */
  leafWetnessPercent?: number;
  rainfallMm?: number;
  windSpeedMs?: number;
  windDirectionDeg?: number;
  solarRadiationWm2?: number;
  irrigationFlowLpm?: number;
  /** Irrigation/source water electrical conductivity — a proxy for salinity, not soil EC. */
  waterEc?: number;
  waterPh?: number;
}

const MEASUREMENT_UNITS: Record<keyof GroundMeasurements, string> = {
  airTemperatureC: 'degC',
  relativeHumidityPercent: 'percent',
  leafWetnessPercent: 'percent',
  rainfallMm: 'mm',
  windSpeedMs: 'm/s',
  windDirectionDeg: 'deg',
  solarRadiationWm2: 'W/m2',
  irrigationFlowLpm: 'L/min',
  waterEc: 'dS/m',
  waterPh: 'pH'
};

/**
 * Generous real-world bounds (same philosophy as WeatherObservation's
 * PLAUSIBLE_RANGES), used to flag OUT_OF_RANGE quality — never to reject or
 * clamp a value outright.
 */
export const MEASUREMENT_PLAUSIBLE_RANGES: Record<keyof GroundMeasurements, PlausibleRange> = {
  airTemperatureC: { min: -90, max: 60 },
  relativeHumidityPercent: { min: 0, max: 100 },
  leafWetnessPercent: { min: 0, max: 100 },
  rainfallMm: { min: 0, max: 500 },
  windSpeedMs: { min: 0, max: 120 },
  windDirectionDeg: { min: 0, max: 360 },
  solarRadiationWm2: { min: 0, max: 1500 }, // ~1361 W/m^2 solar constant at top of atmosphere, generously bounded for surface irradiance
  irrigationFlowLpm: { min: 0, max: 10_000 },
  waterEc: { min: 0, max: 30 }, // fresh water to brine-adjacent salinity
  waterPh: { min: 0, max: 14 }
};

export interface GroundSample {
  id: string;
  fieldId: string;
  zoneId: string | null;
  timestamp: number;
  method: GroundSampleMethod;
  provider: string | null;
  sensorId: string | null;
  measurements: GroundMeasurements;
  provenance: Provenance;
}

export function createGroundSample(params: {
  fieldId: string;
  zoneId?: string | null;
  timestamp?: number;
  method: GroundSampleMethod;
  provider?: string | null;
  sensorId?: string | null;
  measurements: GroundMeasurements;
}): GroundSample {
  if (!params.fieldId) {
    throw new Error('GroundSample requires a fieldId');
  }
  if (Object.keys(params.measurements).length === 0) {
    throw new Error('GroundSample must contain at least one measurement');
  }
  if (params.method === 'GROUND_SENSOR' && !params.sensorId) {
    throw new Error('GroundSample with method GROUND_SENSOR requires a sensorId');
  }
  return {
    id: createId('ground_sample'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    timestamp: params.timestamp ?? Date.now(),
    method: params.method,
    provider: params.provider ?? null,
    sensorId: params.sensorId ?? null,
    measurements: params.measurements,
    provenance: METHOD_PROVENANCE[params.method]
  };
}

export function unitForGroundMeasurement(key: keyof GroundMeasurements): string {
  return MEASUREMENT_UNITS[key];
}
