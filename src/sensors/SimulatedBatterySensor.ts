import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
import { assertSensorCapable, type Sensor } from './Sensor';

const OBSERVATION_TYPE = 'drone.battery.soc';

/** Reports the BatteryModel's state of charge directly — see simulation/BatteryModel.ts for the draw-rate assumptions. */
export class SimulatedBatterySensor implements Sensor<number> {
  id = 'sim-battery-1';
  kind = 'battery';
  platform = 'drone' as const;
  isSimulated = true;
  capabilities = [OBSERVATION_TYPE] as const;

  read(state: DroneState, context: ObservationContext = {}): Observation<number> {
    assertSensorCapable(this, OBSERVATION_TYPE);
    return createSimulatedObservation<number>({
      type: OBSERVATION_TYPE,
      value: state.battery.stateOfCharge,
      unit: 'percent',
      timestamp: state.timestamp,
      location: null,
      source: 'sim-sensor:battery',
      confidence: 1,
      ...context,
      sensorId: this.id
    });
  }
}
