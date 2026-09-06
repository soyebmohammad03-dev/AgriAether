import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
import { assertSensorCapable, type Sensor } from './Sensor';

export interface ImuReading {
  pitch: number;
  roll: number;
  yaw: number;
  yawRate: number;
}

const OBSERVATION_TYPE = 'drone.orientation';
/** Synthetic gyro/accelerometer noise, degrees — a stand-in for real MEMS IMU error, not measured. */
const ORIENTATION_NOISE_DEG = 0.2;

function jitter(value: number): number {
  return value + (Math.random() - 0.5) * 2 * ORIENTATION_NOISE_DEG;
}

/**
 * Reports orientation with small synthetic noise applied per axis, rather
 * than the simulation's exact internal value — real MEMS IMUs never read
 * perfectly clean.
 */
export class SimulatedImuSensor implements Sensor<ImuReading> {
  id = 'sim-imu-1';
  kind = 'imu';
  platform = 'drone' as const;
  isSimulated = true;
  capabilities = [OBSERVATION_TYPE] as const;

  read(state: DroneState, context: ObservationContext = {}): Observation<ImuReading> {
    assertSensorCapable(this, OBSERVATION_TYPE);
    return createSimulatedObservation<ImuReading>({
      type: OBSERVATION_TYPE,
      value: {
        pitch: jitter(state.orientation.pitch),
        roll: jitter(state.orientation.roll),
        yaw: jitter(state.orientation.yaw),
        yawRate: state.yawRate
      },
      unit: 'deg',
      timestamp: state.timestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:imu',
      confidence: 0.92,
      ...context,
      sensorId: this.id
    });
  }
}
