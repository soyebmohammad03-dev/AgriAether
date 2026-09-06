import { describe, expect, it } from 'vitest';
import { createGroundSample } from './GroundSample';
import { assertGroundSampleSensorCapable, groundSampleToObservations } from './groundSampleToObservations';
import { createSensorRecord } from '../domain/SensorRecord';

describe('groundSampleToObservations', () => {
  it('produces one Observation per measurement present', () => {
    const sample = createGroundSample({
      fieldId: 'field_1',
      method: 'GROUND_SENSOR',
      sensorId: 'sensor_1',
      measurements: { airTemperatureC: 22, relativeHumidityPercent: 55 }
    });
    const observations = groundSampleToObservations(sample);
    expect(observations.map((o) => o.type).sort()).toEqual(['ground.air_temperature', 'ground.relative_humidity']);
    expect(observations.every((o) => o.provenance === 'MEASURED')).toBe(true);
    expect(observations.every((o) => o.fieldId === 'field_1')).toBe(true);
  });

  it('flags an out-of-range value as OUT_OF_RANGE without dropping it', () => {
    const sample = createGroundSample({
      fieldId: 'field_1',
      method: 'GROUND_SENSOR',
      sensorId: 'sensor_1',
      measurements: { relativeHumidityPercent: 250 }
    });
    const [obs] = groundSampleToObservations(sample);
    expect(obs.value).toBe(250);
    expect(obs.metadata?.dataQuality).toBe('OUT_OF_RANGE');
  });

  it('a simulated ground sample can never claim MEASURED or EXTERNAL provenance', () => {
    const sample = createGroundSample({ fieldId: 'field_1', method: 'SIMULATION', measurements: { rainfallMm: 2 } });
    expect(groundSampleToObservations(sample)[0].provenance).toBe('SIMULATED');
  });
});

describe('assertGroundSampleSensorCapable', () => {
  it('accepts a sample whose measurements match the sensor capabilities', () => {
    const sensor = createSensorRecord({
      kind: 'leaf-wetness',
      name: 'Leaf wetness sensor',
      platform: 'ground',
      capabilities: ['ground.leaf_wetness'],
      isSimulated: false
    });
    const sample = createGroundSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: sensor.id, measurements: { leafWetnessPercent: 40 } });
    expect(() => assertGroundSampleSensorCapable(sample, sensor)).not.toThrow();
  });

  it('a wind speed value cannot be attributed to a leaf-wetness-only sensor', () => {
    const sensor = createSensorRecord({
      kind: 'leaf-wetness',
      name: 'Leaf wetness sensor',
      platform: 'ground',
      capabilities: ['ground.leaf_wetness'],
      isSimulated: false
    });
    const sample = createGroundSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: sensor.id, measurements: { windSpeedMs: 3 } });
    expect(() => assertGroundSampleSensorCapable(sample, sensor)).toThrow(/only declares capabilities/);
  });
});
