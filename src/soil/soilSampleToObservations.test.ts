import { describe, expect, it } from 'vitest';
import { createSoilSample } from './SoilSample';
import { assertSoilSampleSensorCapable, soilSampleToObservations } from './soilSampleToObservations';
import { createSensorRecord } from '../domain/SensorRecord';

describe('soilSampleToObservations', () => {
  it('produces one Observation per measurement present', () => {
    const sample = createSoilSample({ fieldId: 'field_1', method: 'LABORATORY', measurements: { ph: 6.5, ec: 1.2 } });
    const observations = soilSampleToObservations(sample);
    expect(observations.map((o) => o.type).sort()).toEqual(['soil.ec', 'soil.ph']);
    expect(observations.every((o) => o.provenance === 'MEASURED')).toBe(true);
    expect(observations.every((o) => o.fieldId === 'field_1')).toBe(true);
  });

  it('a weather observation can never become a soil measurement — soil conversions only ever read a SoilSample, never weather data', () => {
    const sample = createSoilSample({ fieldId: 'field_1', method: 'LABORATORY', measurements: { moisturePercent: 30 } });
    const observations = soilSampleToObservations(sample);
    expect(observations[0].source).not.toMatch(/external:/);
  });
});

describe('assertSoilSampleSensorCapable', () => {
  it('accepts a sample whose measurements match the sensor capabilities', () => {
    const sensor = createSensorRecord({ kind: 'soil-ph', name: 'pH probe', platform: 'ground', capabilities: ['soil.ph'], isSimulated: false });
    const sample = createSoilSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: sensor.id, measurements: { ph: 6.5 } });
    expect(() => assertSoilSampleSensorCapable(sample, sensor)).not.toThrow();
  });

  it('a soil moisture value cannot be attributed to a pH-only sensor (or, by the same rule, an RGB camera)', () => {
    const phSensor = createSensorRecord({ kind: 'soil-ph', name: 'pH probe', platform: 'ground', capabilities: ['soil.ph'], isSimulated: false });
    const sample = createSoilSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: phSensor.id, measurements: { moisturePercent: 30 } });
    expect(() => assertSoilSampleSensorCapable(sample, phSensor)).toThrow(/only declares capabilities/);
  });
});
