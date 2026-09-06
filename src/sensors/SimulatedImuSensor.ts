import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation } from '../observation/Observation';
import type { Sensor } from './Sensor';

export interface ImuReading {
  pitch: number;
  roll: number;
  yaw: number;
  yawRate: number;
}

export class SimulatedImuSensor implements Sensor<ImuReading> {
  id = 'sim-imu-1';
  kind = 'imu';
  platform = 'drone' as const;
  isSimulated = true;

  read(state: DroneState): Observation<ImuReading> {
    return createSimulatedObservation<ImuReading>({
      type: 'drone.orientation',
      value: { ...state.orientation, yawRate: state.yawRate },
      unit: 'deg',
      timestamp: state.timestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:imu',
      confidence: 1
    });
  }
}
