import { describe, expect, it } from 'vitest';
import { assertValidObservation, createSimulatedObservation, createUnavailableObservation, type Observation } from './Observation';

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
});
