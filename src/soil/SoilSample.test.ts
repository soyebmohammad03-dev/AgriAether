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
});
