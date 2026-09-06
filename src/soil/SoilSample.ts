import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';

export type SoilSampleMethod = 'FIELD_SAMPLING' | 'ZONE_SAMPLING' | 'LABORATORY' | 'GROUND_SENSOR' | 'EXTERNAL_DATASET' | 'SIMULATION';

/** Which method implies which provenance — enforced by createSoilSample so a method and its provenance can never disagree (e.g. a SIMULATION sample claiming MEASURED). */
const METHOD_PROVENANCE: Record<SoilSampleMethod, Provenance> = {
  FIELD_SAMPLING: 'MEASURED',
  ZONE_SAMPLING: 'MEASURED',
  LABORATORY: 'MEASURED',
  GROUND_SENSOR: 'MEASURED',
  EXTERNAL_DATASET: 'EXTERNAL',
  SIMULATION: 'SIMULATED'
};

export interface SoilMeasurements {
  moisturePercent?: number;
  temperatureC?: number;
  ec?: number;
  ph?: number;
  nitrogenPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
}

const MEASUREMENT_UNITS: Record<keyof SoilMeasurements, string> = {
  moisturePercent: 'percent',
  temperatureC: 'degC',
  ec: 'dS/m',
  ph: 'pH',
  nitrogenPpm: 'ppm',
  phosphorusPpm: 'ppm',
  potassiumPpm: 'ppm'
};

/**
 * One soil sample/reading. `sensorId` is required when method is
 * GROUND_SENSOR — see assertSoilSampleSensorCapable, which checks the
 * referenced sensor actually declares capability for every measurement
 * present here (the mechanism that keeps "RGB camera -> soil moisture"
 * impossible for soil data specifically).
 */
export interface SoilSample {
  id: string;
  fieldId: string;
  zoneId: string | null;
  depthCm: number | null;
  timestamp: number;
  method: SoilSampleMethod;
  laboratoryOrProvider: string | null;
  sensorId: string | null;
  measurements: SoilMeasurements;
  provenance: Provenance;
}

export function createSoilSample(params: {
  fieldId: string;
  zoneId?: string | null;
  depthCm?: number | null;
  timestamp?: number;
  method: SoilSampleMethod;
  laboratoryOrProvider?: string | null;
  sensorId?: string | null;
  measurements: SoilMeasurements;
}): SoilSample {
  if (!params.fieldId) {
    throw new Error('SoilSample requires a fieldId');
  }
  if (Object.keys(params.measurements).length === 0) {
    throw new Error('SoilSample must contain at least one measurement');
  }
  if (params.method === 'GROUND_SENSOR' && !params.sensorId) {
    throw new Error('SoilSample with method GROUND_SENSOR requires a sensorId');
  }
  return {
    id: createId('soil_sample'),
    fieldId: params.fieldId,
    zoneId: params.zoneId ?? null,
    depthCm: params.depthCm ?? null,
    timestamp: params.timestamp ?? Date.now(),
    method: params.method,
    laboratoryOrProvider: params.laboratoryOrProvider ?? null,
    sensorId: params.sensorId ?? null,
    measurements: params.measurements,
    provenance: METHOD_PROVENANCE[params.method]
  };
}

export function unitForMeasurement(key: keyof SoilMeasurements): string {
  return MEASUREMENT_UNITS[key];
}
