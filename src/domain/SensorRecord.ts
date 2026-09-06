import { createId } from './id';
import type { Sensor, SensorPlatform } from '../sensors/Sensor';

export type SensorKind =
  | 'gps' | 'imu' | 'barometer' | 'battery' // drone, implemented as of Phase 1/2
  | 'rgb-camera' | 'multispectral-camera' | 'thermal-camera' | 'lidar' // drone, not yet implemented
  | 'soil-moisture' | 'soil-temperature' | 'soil-ec' | 'soil-ph' // ground, not yet implemented
  | 'weather-station' | 'rain-gauge' | 'anemometer' | 'air-temperature' | 'humidity'; // fixed-station, not yet implemented

export type CalibrationStatus = 'CALIBRATED' | 'UNCALIBRATED' | 'UNKNOWN';

/**
 * The persisted registry record for a sensor — distinct from the runtime
 * `Sensor<T>` interface in sensors/Sensor.ts, which is a live reader with a
 * `.read()` method. A SensorRecord is what the registry stores and lists;
 * a `Sensor<T>` is what the telemetry pipeline calls each tick. The two are
 * linked by id, not merged, because "what the sensor is" (registry) and
 * "how to read it right now" (runtime) are different concerns — one is
 * data, the other is behavior.
 */
export interface SensorRecord {
  id: string;
  kind: SensorKind;
  name: string;
  manufacturer: string | null;
  platform: SensorPlatform;
  /** Dot-namespaced Observation types this sensor is allowed to produce. */
  capabilities: readonly string[];
  isSimulated: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  calibration: {
    status: CalibrationStatus;
    calibratedAt: number | null;
  };
}

export function createSensorRecord(params: {
  kind: SensorKind;
  name: string;
  manufacturer?: string | null;
  platform: SensorPlatform;
  capabilities: readonly string[];
  isSimulated: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  calibration?: { status: CalibrationStatus; calibratedAt: number | null };
}): SensorRecord {
  if (params.capabilities.length === 0) {
    throw new Error(`SensorRecord "${params.name}" must declare at least one capability`);
  }
  return {
    id: createId('sensor'),
    kind: params.kind,
    name: params.name,
    manufacturer: params.manufacturer ?? null,
    platform: params.platform,
    capabilities: params.capabilities,
    isSimulated: params.isSimulated,
    status: params.status ?? 'ACTIVE',
    calibration: params.calibration ?? { status: params.isSimulated ? 'CALIBRATED' : 'UNKNOWN', calibratedAt: params.isSimulated ? Date.now() : null }
  };
}

const SENSOR_DISPLAY_NAMES: Partial<Record<SensorKind, string>> = {
  gps: 'Simulated GNSS Receiver',
  imu: 'Simulated IMU',
  barometer: 'Simulated Barometer',
  battery: 'Simulated Battery Telemetry'
};

/**
 * Builds a registry record directly from a live `Sensor<T>` instance, so
 * the id/kind/platform/capabilities the registry stores can never drift
 * from what the sensor itself reports at runtime.
 */
export function createSensorRecordFromSensor(sensor: Sensor<unknown>): SensorRecord {
  const kind = sensor.kind as SensorKind;
  return {
    id: sensor.id,
    kind,
    name: SENSOR_DISPLAY_NAMES[kind] ?? sensor.kind,
    manufacturer: null,
    platform: sensor.platform,
    capabilities: sensor.capabilities,
    isSimulated: sensor.isSimulated,
    status: 'ACTIVE',
    calibration: { status: sensor.isSimulated ? 'CALIBRATED' : 'UNKNOWN', calibratedAt: sensor.isSimulated ? Date.now() : null }
  };
}
