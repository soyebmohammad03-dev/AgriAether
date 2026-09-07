import { describe, expect, it } from 'vitest';
import { createSoilSample } from './SoilSample';

describe('createSoilSample', () => {
  it('rejects a sample with no measurements', () => {
    expect(() => createSoilSample({ fieldId: 'field_1', method: 'LABORATORY', measurements: {} })).toThrow(/at least one measurement/);
  });

  it('rejects a GROUND_SENSOR sample with no sensorId', () => {
    expect(() =>
      createSoilSample({ fieldId: 'field_1', method: 'GROUND_SENSOR', measurements: { moisturePercent: 30 } })
    ).toThrow(/requires a sensorId/);
  });

  it('assigns MEASURED provenance for LABORATORY/FIELD_SAMPLING/ZONE_SAMPLING/GROUND_SENSOR', () => {
    expect(createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 } }).provenance).toBe('MEASURED');
    expect(createSoilSample({ fieldId: 'f', method: 'FIELD_SAMPLING', measurements: { ph: 6.5 } }).provenance).toBe('MEASURED');
    expect(createSoilSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: 's1', measurements: { ph: 6.5 } }).provenance).toBe('MEASURED');
  });

  it('assigns SIMULATED provenance for SIMULATION and EXTERNAL for EXTERNAL_DATASET — never MEASURED', () => {
    expect(createSoilSample({ fieldId: 'f', method: 'SIMULATION', measurements: { ph: 6.5 } }).provenance).toBe('SIMULATED');
    expect(createSoilSample({ fieldId: 'f', method: 'EXTERNAL_DATASET', measurements: { ph: 6.5 } }).provenance).toBe('EXTERNAL');
  });

  it('accepts a texture-only sample with no numeric measurements', () => {
    expect(() => createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: {}, textureClass: 'CLAY_LOAM' })).not.toThrow();
  });

  it('rejects an out-of-range latitude/longitude in location', () => {
    expect(() =>
      createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 }, location: { lat: 200, lon: 20 } })
    ).toThrow(/latitude/);
  });

  it('accepts a valid location and preserves it', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 }, location: { lat: 10, lon: 20 } });
    expect(sample.location).toEqual({ lat: 10, lon: 20 });
  });

  it('rejects a confidence outside 0-1', () => {
    expect(() => createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 }, confidence: 1.5 })).toThrow(/confidence must be between/);
  });

  it('defaults location, textureClass, and confidence to null', () => {
    const sample = createSoilSample({ fieldId: 'f', method: 'LABORATORY', measurements: { ph: 6.5 } });
    expect(sample.location).toBeNull();
    expect(sample.textureClass).toBeNull();
    expect(sample.confidence).toBeNull();
  });
});
