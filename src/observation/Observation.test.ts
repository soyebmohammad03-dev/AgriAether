import { describe, expect, it } from 'vitest';
import { assertValidObservation, createImportedObservation, createPredictedObservation, createSimulatedObservation, createUnavailableObservation, type Observation } from './Observation';

describe('createSimulatedObservation', () => {
  it('always tags provenance as SIMULATED', () => {
    const obs = createSimulatedObservation({
      type: 'drone.altitude.agl',
      value: 42,
      unit: 'm',
      timestamp: Date.now(),
      source: 'sim-sensor:barometer'
    });
    expect(obs.provenance).toBe('SIMULATED');
    expect(obs.status).toBe('OK');
  });

  it('defaults domain context fields to null when omitted', () => {
    const obs = createSimulatedObservation({ type: 'drone.altitude.agl', value: 1, unit: 'm', timestamp: Date.now(), source: 'sim-sensor:barometer' });
    expect(obs.farmId).toBeNull();
    expect(obs.fieldId).toBeNull();
    expect(obs.sensorId).toBeNull();
  });

  it('carries provided domain context through', () => {
    const obs = createSimulatedObservation({
      type: 'drone.altitude.agl',
      value: 1,
      unit: 'm',
      timestamp: Date.now(),
      source: 'sim-sensor:barometer',
      farmId: 'farm_1',
      fieldId: 'field_1',
      missionId: 'mission_1',
      droneId: 'drone_1'
    });
    expect(obs).toMatchObject({ farmId: 'farm_1', fieldId: 'field_1', missionId: 'mission_1', droneId: 'drone_1' });
  });
});

describe('createUnavailableObservation', () => {
  it('produces a null value with UNAVAILABLE status', () => {
    const obs = createUnavailableObservation({ type: 'crop.ndvi', timestamp: Date.now(), source: 'none' });
    expect(obs.value).toBeNull();
    expect(obs.status).toBe('UNAVAILABLE');
  });
});

describe('assertValidObservation', () => {
  it('rejects an observation with no timestamp', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'drone.altitude.agl',
      value: 1,
      unit: 'm',
      timestamp: NaN,
      location: null,
      source: 'sim-sensor:barometer',
      provenance: 'SIMULATED',
      confidence: 1,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/timestamp/);
  });

  it('a simulated source can never claim MEASURED provenance', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'soil.moisture',
      value: 30,
      unit: 'percent',
      timestamp: Date.now(),
      location: null,
      source: 'sim-sensor:soil-probe',
      provenance: 'MEASURED',
      confidence: 1,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/can never be MEASURED/);
  });

  it('a value cannot be presented as OK with no value', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'drone.altitude.agl',
      value: null,
      unit: 'm',
      timestamp: Date.now(),
      location: null,
      source: 'sim-sensor:barometer',
      provenance: 'SIMULATED',
      confidence: 1,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/marked OK but has no value/);
  });

  it('rejects an out-of-range confidence', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'drone.altitude.agl',
      value: 1,
      unit: 'm',
      timestamp: Date.now(),
      location: null,
      source: 'sim-sensor:barometer',
      provenance: 'SIMULATED',
      confidence: 1.5,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/confidence/);
  });

  it('an external-provider source can never claim SIMULATED provenance (weather cannot become a drone reading)', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'weather.air_temperature',
      value: 20,
      unit: 'degC',
      timestamp: Date.now(),
      location: null,
      source: 'external:open-meteo',
      provenance: 'SIMULATED',
      confidence: null,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/external-provider source/);
  });

  it('a model source can never claim MEASURED provenance — a prediction is not a measurement', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'crop.stress_class_confidence',
      value: 0.8,
      unit: null,
      timestamp: Date.now(),
      location: null,
      source: 'model:crop-stress-v1',
      provenance: 'MEASURED',
      confidence: 0.8,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/model source/);
  });

  it('a synthetic dataset source can never claim MEASURED — it cannot be silently promoted to real data', () => {
    const obs: Observation<number> = {
      id: 'x',
      type: 'multispectral.ndvi',
      value: 0.5,
      unit: null,
      timestamp: Date.now(),
      location: null,
      source: 'synthetic-dataset-generator',
      provenance: 'MEASURED',
      confidence: null,
      status: 'OK'
    };
    expect(() => assertValidObservation(obs)).toThrow(/simulated or synthetic source/);
  });
});

describe('createPredictedObservation', () => {
  it('always tags provenance PREDICTED and sources it to the model', () => {
    const obs = createPredictedObservation({
      type: 'crop.stress_class_confidence',
      value: 0.72,
      unit: null,
      timestamp: Date.now(),
      modelId: 'crop-stress-v1',
      modelVersion: '0.1.0',
      confidence: 0.72
    });
    expect(obs.provenance).toBe('PREDICTED');
    expect(obs.source).toBe('model:crop-stress-v1');
    expect(obs.metadata).toMatchObject({ modelVersion: '0.1.0' });
  });
});

describe('createImportedObservation', () => {
  it('requires source to start with "import:"', () => {
    expect(() =>
      createImportedObservation({
        id: 'obs_import_1',
        type: 'soil.moisture',
        value: 35.5,
        unit: 'percent',
        timestamp: Date.now(),
        source: 'csv-upload',
        provenance: 'MEASURED'
      })
    ).toThrow(/start with "import:"/);
  });

  it('accepts an explicit MEASURED provenance with a deterministic id', () => {
    const obs = createImportedObservation({
      id: 'obs_import_abc123',
      type: 'soil.moisture',
      value: 35.5,
      unit: 'percent',
      timestamp: Date.now(),
      source: 'import:source_1',
      provenance: 'MEASURED'
    });
    expect(obs.id).toBe('obs_import_abc123');
    expect(obs.provenance).toBe('MEASURED');
  });

  it('rejects an imported observation claiming SIMULATED provenance', () => {
    expect(() =>
      assertValidObservation({
        id: 'obs_import_1',
        type: 'soil.moisture',
        value: 1,
        unit: null,
        timestamp: Date.now(),
        location: null,
        source: 'import:source_1',
        provenance: 'SIMULATED',
        confidence: null,
        status: 'OK'
      })
    ).toThrow(/never be SIMULATED/);
  });
});
