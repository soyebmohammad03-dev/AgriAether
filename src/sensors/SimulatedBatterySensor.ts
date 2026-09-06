import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation } from '../observation/Observation';
import type { Sensor } from './Sensor';

export class SimulatedBatterySensor implements Sensor<number> {
  id = 'sim-battery-1';
  kind = 'battery';
  platform = 'drone' as const;
  isSimulated = true;

  read(state: DroneState): Observation<number> {
    return createSimulatedObservation<number>({
      type: 'drone.battery.soc',
      value: state.battery.stateOfCharge,
      unit: 'percent',
      timestamp: state.timestamp,
      location: null,
      source: 'sim-sensor:battery',
      confidence: 1
    });
  }
}
