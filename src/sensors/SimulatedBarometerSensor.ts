import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation } from '../observation/Observation';
import type { Sensor } from './Sensor';

export class SimulatedBarometerSensor implements Sensor<number> {
  id = 'sim-baro-1';
  kind = 'barometer';
  platform = 'drone' as const;
  isSimulated = true;

  read(state: DroneState): Observation<number> {
    return createSimulatedObservation<number>({
      type: 'drone.altitude.agl',
      value: state.altitudeAgl,
      unit: 'm',
      timestamp: state.timestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:barometer',
      confidence: 1
    });
  }
}
