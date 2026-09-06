import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation } from '../observation/Observation';
import type { Sensor } from './Sensor';

export interface SimulationCoordinate {
  frame: 'simulation-local';
  x: number;
  z: number;
}

/**
 * Reports the drone's horizontal position in the simulation's own local
 * frame — meters from the scene origin. This deliberately does NOT produce
 * a lat/lon pair. The original demo faked GPS by offsetting a real Delhi
 * coordinate by scene units; that made an arbitrary number look like a
 * geodetic position. A real coordinate reference system (WGS84 + a
 * projected CRS per farm) is Phase-3 work per the roadmap — until then,
 * "position" in this codebase means simulation-local meters, full stop.
 */
export class SimulatedGpsSensor implements Sensor<SimulationCoordinate> {
  id = 'sim-gps-1';
  kind = 'gps';
  platform = 'drone' as const;
  isSimulated = true;

  read(state: DroneState): Observation<SimulationCoordinate> {
    return createSimulatedObservation<SimulationCoordinate>({
      type: 'drone.position.local',
      value: { frame: 'simulation-local', x: state.position.x, z: state.position.z },
      unit: 'm',
      timestamp: state.timestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:gps',
      confidence: 1
    });
  }
}
