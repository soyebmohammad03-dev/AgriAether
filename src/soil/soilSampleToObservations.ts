import { createId } from '../domain/id';
import type { Observation, ObservationContext } from '../observation/Observation';
import { assertValidObservation } from '../observation/Observation';
import type { SensorRecord } from '../domain/SensorRecord';
import { assertSensorCapable } from '../sensors/Sensor';
import type { SoilMeasurements, SoilSample } from './SoilSample';
import { unitForMeasurement } from './SoilSample';

const MEASUREMENT_TO_TYPE: Record<keyof SoilMeasurements, string> = {
  moisturePercent: 'soil.moisture',
  temperatureC: 'soil.temperature',
  ec: 'soil.ec',
  ph: 'soil.ph',
  nitrogenPpm: 'soil.nitrogen',
  phosphorusPpm: 'soil.phosphorus',
  potassiumPpm: 'soil.potassium'
};

/**
 * Rejects a GROUND_SENSOR sample if the referenced sensor doesn't declare
 * capability for one of the measurements present — the soil-specific
 * instance of the same rule sensors/Sensor.ts's assertSensorCapable already
 * enforces for drone telemetry (e.g. it structurally prevents an EC probe's
 * SoilSample from also reporting pH unless it actually declares that
 * capability too).
 */
export function assertSoilSampleSensorCapable(sample: SoilSample, sensor: SensorRecord): void {
  for (const key of Object.keys(sample.measurements) as Array<keyof SoilMeasurements>) {
    assertSensorCapable(sensor, MEASUREMENT_TO_TYPE[key]);
  }
}

/** Explodes a SoilSample into canonical per-quantity Observations, the same pattern weatherObservationToObservations.ts uses. */
export function soilSampleToObservations(sample: SoilSample, context: ObservationContext = {}): Observation<number>[] {
  const observations: Observation<number>[] = [];

  for (const key of Object.keys(sample.measurements) as Array<keyof SoilMeasurements>) {
    const value = sample.measurements[key];
    if (value === undefined) continue;

    const obs: Observation<number> = {
      id: createId(`obs_${MEASUREMENT_TO_TYPE[key]}`),
      type: MEASUREMENT_TO_TYPE[key],
      value,
      unit: unitForMeasurement(key),
      timestamp: sample.timestamp,
      location: null,
      source: sample.sensorId ? `sensor:${sample.sensorId}` : `soil-sample:${sample.method.toLowerCase()}`,
      provenance: sample.provenance,
      confidence: null,
      status: 'OK',
      fieldId: sample.fieldId,
      zoneId: sample.zoneId,
      sensorId: sample.sensorId,
      metadata: sample.depthCm !== null ? { depthCm: sample.depthCm } : null,
      ...context
    };
    assertValidObservation(obs);
    observations.push(obs);
  }

  return observations;
}
