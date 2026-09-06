import { describe, expect, it } from 'vitest';
import { createGroundSample } from './GroundSample';

describe('createGroundSample', () => {
  it('rejects a sample with no measurements', () => {
    expect(() => createGroundSample({ fieldId: 'field_1', method: 'SIMULATION', measurements: {} })).toThrow(/at least one measurement/);
  });

  it('rejects a GROUND_SENSOR sample with no sensorId', () => {
    expect(() =>
      createGroundSample({ fieldId: 'field_1', method: 'GROUND_SENSOR', measurements: { airTemperatureC: 20 } })
    ).toThrow(/requires a sensorId/);
  });

  it('assigns MEASURED provenance for GROUND_SENSOR', () => {
    expect(
      createGroundSample({ fieldId: 'f', method: 'GROUND_SENSOR', sensorId: 's1', measurements: { airTemperatureC: 20 } }).provenance
    ).toBe('MEASURED');
  });

  it('assigns SIMULATED for SIMULATION and EXTERNAL for EXTERNAL_DATASET — never MEASURED', () => {
    expect(createGroundSample({ fieldId: 'f', method: 'SIMULATION', measurements: { airTemperatureC: 20 } }).provenance).toBe('SIMULATED');
    expect(createGroundSample({ fieldId: 'f', method: 'EXTERNAL_DATASET', measurements: { airTemperatureC: 20 } }).provenance).toBe('EXTERNAL');
  });
});
