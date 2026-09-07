import { describe, expect, it } from 'vitest';
import { createSoilSample } from './SoilSample';
import { assertSoilSampleSensorCapable, soilSampleToObservations, soilTextureToObservation } from './soilSampleToObservations';
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

  it('carries the sample location and confidence through to each Observation', () => {
    const sample = createSoilSample({
      fieldId: 'field_1',
      method: 'LABORATORY',
      measurements: { ph: 6.5 },
      location: { lat: 10, lon: 20 },
      confidence: 0.9
    });
    const [obs] = soilSampleToObservations(sample);
    expect(obs.location).toEqual({ frame: 'geodetic', crs: 'EPSG:4326', lat: 10, lon: 20 });
    expect(obs.confidence).toBe(0.9);
  });
});

describe('soilTextureToObservation', () => {
  it('returns null when the sample has no texture class', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 } });
    expect(soilTextureToObservation(sample)).toBeNull();
  });

  it('produces a soil.texture Observation<string> carrying the sample provenance', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: {}, textureClass: 'CLAY_LOAM' });
    const obs = soilTextureToObservation(sample);
    expect(obs?.type).toBe('soil.texture');
    expect(obs?.value).toBe('CLAY_LOAM');
    expect(obs?.provenance).toBe('MEASURED');
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
