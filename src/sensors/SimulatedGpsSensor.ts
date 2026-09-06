import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
import { assertSensorCapable, type Sensor } from './Sensor';

export interface SimulationCoordinate {
  frame: 'simulation-local';
  x: number;
  z: number;
}

const OBSERVATION_TYPE = 'drone.position.local';
/** Consumer GNSS-class receivers typically update at ~5 Hz, not every render frame. */
const UPDATE_INTERVAL_MS = 200;
/** Synthetic horizontal jitter, meters — a stand-in for real GNSS multipath/atmospheric error, not measured from anything. */
const NOISE_METERS = 0.3;

/**
 * Reports the drone's horizontal position in the simulation's own local
 * frame — meters from the scene origin. This deliberately does NOT produce
 * a lat/lon pair. The original demo faked GPS by offsetting a real Delhi
 * coordinate by scene units; that made an arbitrary number look like a
 * geodetic position. A real coordinate reference system (WGS84 + a
 * projected CRS per farm) is Phase-3 work per the roadmap — until then,
 * "position" in this codebase means simulation-local meters, full stop.
 *
 * Simulates two real GNSS characteristics rather than reporting a perfect
 * position every frame: a fixed update rate (position is only resampled
 * every UPDATE_INTERVAL_MS, holding the prior reading between updates) and
 * small random horizontal jitter. Both are synthetic and documented here,
 * not derived from any real receiver's spec sheet.
 */
export class SimulatedGpsSensor implements Sensor<SimulationCoordinate> {
  id = 'sim-gps-1';
  kind = 'gps';
  platform = 'drone' as const;
  isSimulated = true;
  capabilities = [OBSERVATION_TYPE] as const;

  private lastSampleTimestamp = -Infinity;
  private lastValue: SimulationCoordinate = { frame: 'simulation-local', x: 0, z: 0 };

  read(state: DroneState, context: ObservationContext = {}): Observation<SimulationCoordinate> {
    if (state.timestamp - this.lastSampleTimestamp >= UPDATE_INTERVAL_MS) {
      this.lastSampleTimestamp = state.timestamp;
      this.lastValue = {
        frame: 'simulation-local',
        x: state.position.x + (Math.random() - 0.5) * 2 * NOISE_METERS,
        z: state.position.z + (Math.random() - 0.5) * 2 * NOISE_METERS
      };
    }

    assertSensorCapable(this, OBSERVATION_TYPE);
    return createSimulatedObservation<SimulationCoordinate>({
      type: OBSERVATION_TYPE,
      value: this.lastValue,
      unit: 'm',
      timestamp: this.lastSampleTimestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:gps',
      confidence: 0.9,
      ...context,
      sensorId: this.id
    });
  }
}
