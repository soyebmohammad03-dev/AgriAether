import type { SensorRecord } from '../domain/SensorRecord';
import type { Observation } from '../observation/Observation';

export type SensorHealthStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'CALIBRATION_REQUIRED' | 'UNKNOWN';

export interface SensorHealthReport {
  sensorId: string;
  status: SensorHealthStatus;
  isSimulated: boolean;
  reason: string;
}

/** How long a sensor can go without a new observation before it's considered OFFLINE. */
const MAX_SILENCE_MS = 30_000;

/**
 * A small, explicit rule set from real signals already in this codebase
 * (calibration state, observation recency/validity) — never fabricated
 * hardware telemetry. `isSimulated` is always carried alongside `status` so
 * "ONLINE" is never displayed without the "(SIMULATED)" qualifier the UI
 * requires for anything that isn't real hardware.
 */
export function evaluateSensorHealth(sensor: SensorRecord, recentObservations: ReadonlyArray<Observation<unknown>>, now: number = Date.now()): SensorHealthReport {
  if (sensor.status === 'INACTIVE') {
    return { sensorId: sensor.id, status: 'OFFLINE', isSimulated: sensor.isSimulated, reason: 'Sensor is marked inactive in the registry.' };
  }
  if (sensor.calibration.status === 'UNCALIBRATED') {
    return { sensorId: sensor.id, status: 'CALIBRATION_REQUIRED', isSimulated: sensor.isSimulated, reason: 'Sensor calibration status is UNCALIBRATED.' };
  }
  const ownObservations = recentObservations.filter((o) => o.sensorId === sensor.id);
  if (ownObservations.length === 0) {
    return { sensorId: sensor.id, status: 'UNKNOWN', isSimulated: sensor.isSimulated, reason: 'No recent observations from this sensor to evaluate.' };
  }
  const mostRecent = Math.max(...ownObservations.map((o) => o.timestamp));
  if (now - mostRecent > MAX_SILENCE_MS) {
    return { sensorId: sensor.id, status: 'OFFLINE', isSimulated: sensor.isSimulated, reason: `No observation in the last ${MAX_SILENCE_MS / 1000}s.` };
  }
  const invalidCount = ownObservations.filter((o) => o.status !== 'OK').length;
  if (invalidCount > ownObservations.length / 2) {
    return { sensorId: sensor.id, status: 'DEGRADED', isSimulated: sensor.isSimulated, reason: 'More than half of recent observations are not OK.' };
  }
  return { sensorId: sensor.id, status: 'ONLINE', isSimulated: sensor.isSimulated, reason: 'Recent observations present and valid.' };
}
