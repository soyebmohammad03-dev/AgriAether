import { createId } from '../domain/id';
import type { Observation, ObservationContext } from '../observation/Observation';
import { assertValidObservation } from '../observation/Observation';
import type { SensorRecord } from '../domain/SensorRecord';
import { assertSensorCapable } from './Sensor';
import { deriveDataQuality } from '../sensing/DataQuality';
import type { GroundMeasurements, GroundSample } from './GroundSample';
import { unitForGroundMeasurement, MEASUREMENT_PLAUSIBLE_RANGES } from './GroundSample';

const MEASUREMENT_TO_TYPE: Record<keyof GroundMeasurements, string> = {
  airTemperatureC: 'ground.air_temperature',
  relativeHumidityPercent: 'ground.relative_humidity',
  leafWetnessPercent: 'ground.leaf_wetness',
  rainfallMm: 'ground.rainfall',
  windSpeedMs: 'ground.wind_speed',
  windDirectionDeg: 'ground.wind_direction',
  solarRadiationWm2: 'ground.solar_radiation',
  irrigationFlowLpm: 'ground.irrigation_flow',
  waterEc: 'ground.water_ec',
  waterPh: 'ground.water_ph'
};

/** The GroundSample-specific instance of the same capability check soilSampleToObservations.ts and sensors/Sensor.ts's assertSensorCapable already enforce elsewhere. */
export function assertGroundSampleSensorCapable(sample: GroundSample, sensor: SensorRecord): void {
  for (const key of Object.keys(sample.measurements) as Array<keyof GroundMeasurements>) {
    assertSensorCapable(sensor, MEASUREMENT_TO_TYPE[key]);
  }
}

/**
 * Explodes a GroundSample into canonical per-quantity Observations, the
 * same pattern soilSampleToObservations.ts and weatherObservationToObservations.ts
 * use. Each Observation's `metadata.dataQuality` is computed from the
 * documented plausible range — an out-of-range value is still recorded (not
 * dropped), just flagged, so the source of a garbled reading can be
 * investigated instead of hidden.
 */
export function groundSampleToObservations(sample: GroundSample, context: ObservationContext = {}): Observation<number>[] {
  const observations: Observation<number>[] = [];

  for (const key of Object.keys(sample.measurements) as Array<keyof GroundMeasurements>) {
    const value = sample.measurements[key];
    if (value === undefined) continue;

    const quality = deriveDataQuality({ hasValue: true, value, plausibleRange: MEASUREMENT_PLAUSIBLE_RANGES[key] });

    const obs: Observation<number> = {
      id: createId(`obs_${MEASUREMENT_TO_TYPE[key]}`),
      type: MEASUREMENT_TO_TYPE[key],
      value,
      unit: unitForGroundMeasurement(key),
      timestamp: sample.timestamp,
      location: null,
      source: sample.sensorId ? `sensor:${sample.sensorId}` : sample.provider ? `external:${sample.provider}` : `ground-sample:${sample.method.toLowerCase()}`,
      provenance: sample.provenance,
      confidence: null,
      status: 'OK',
      fieldId: sample.fieldId,
      zoneId: sample.zoneId,
      sensorId: sample.sensorId,
      metadata: { dataQuality: quality },
      ...context
    };
    assertValidObservation(obs);
    observations.push(obs);
  }

  return observations;
}
