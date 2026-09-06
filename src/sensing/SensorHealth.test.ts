import { describe, expect, it } from 'vitest';
import { evaluateSensorHealth } from './SensorHealth';
import { createSensorRecord } from '../domain/SensorRecord';
import type { Observation } from '../observation/Observation';

function makeObservation(sensorId: string, timestamp: number, status: Observation<number>['status'] = 'OK'): Observation<number> {
  return {
    id: `obs_${timestamp}`,
    type: 'drone.battery.soc',
    value: status === 'OK' ? 90 : null,
    unit: 'percent',
    timestamp,
    location: null,
    source: `sim-sensor:${sensorId}`,
    provenance: 'SIMULATED',
    confidence: null,
    status,
    sensorId
  };
}

describe('evaluateSensorHealth', () => {
  const sensor = createSensorRecord({
    kind: 'battery',
    name: 'Sim Battery',
    platform: 'drone',
    capabilities: ['drone.battery.soc'],
    isSimulated: true
  });

  it('is UNKNOWN with no recent observations, always carrying isSimulated', () => {
    const report = evaluateSensorHealth(sensor, []);
    expect(report.status).toBe('UNKNOWN');
    expect(report.isSimulated).toBe(true);
  });

  it('is ONLINE with a recent valid observation', () => {
    const now = 100_000;
    const report = evaluateSensorHealth(sensor, [makeObservation(sensor.id, now - 1000)], now);
    expect(report.status).toBe('ONLINE');
  });

  it('is OFFLINE when the most recent observation is older than the silence window', () => {
    const now = 100_000;
    const report = evaluateSensorHealth(sensor, [makeObservation(sensor.id, now - 60_000)], now);
    expect(report.status).toBe('OFFLINE');
  });

  it('is CALIBRATION_REQUIRED when the registry says UNCALIBRATED, regardless of observations', () => {
    const uncalibrated = createSensorRecord({
      kind: 'soil-ph',
      name: 'pH probe',
      platform: 'ground',
      capabilities: ['soil.ph'],
      isSimulated: false,
      calibration: { status: 'UNCALIBRATED', calibratedAt: null, source: null, version: null, validityDays: null, notes: null }
    });
    const report = evaluateSensorHealth(uncalibrated, []);
    expect(report.status).toBe('CALIBRATION_REQUIRED');
    expect(report.isSimulated).toBe(false);
  });

  it('is OFFLINE when marked INACTIVE in the registry', () => {
    const inactive = createSensorRecord({
      kind: 'gps',
      name: 'GPS',
      platform: 'drone',
      capabilities: ['drone.position.local'],
      isSimulated: true,
      status: 'INACTIVE'
    });
    expect(evaluateSensorHealth(inactive, []).status).toBe('OFFLINE');
  });
});
