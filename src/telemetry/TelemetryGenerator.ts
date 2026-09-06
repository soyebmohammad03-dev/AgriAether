import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation } from '../observation/Observation';
import type { Sensor } from '../sensors/Sensor';
import { SimulatedGpsSensor, type SimulationCoordinate } from '../sensors/SimulatedGpsSensor';
import { SimulatedImuSensor, type ImuReading } from '../sensors/SimulatedImuSensor';
import { SimulatedBarometerSensor } from '../sensors/SimulatedBarometerSensor';
import { SimulatedBatterySensor } from '../sensors/SimulatedBatterySensor';

/**
 * The boundary described in the Phase 0 audit:
 *
 *   Simulation state -> Telemetry generator -> Observation[] -> app state -> UI
 *
 * This is the only place DroneState is turned into Observations. The
 * renderer and UI never read DroneState directly and never compute a
 * telemetry value themselves — they consume this module's output.
 *
 * groundSpeed, heading, and missionProgress are quantities the simulation
 * engine already derives (not sensed by a discrete instrument analog), so
 * they are wrapped directly here with source "simulation-engine" rather
 * than routed through a Sensor implementation.
 */
export interface Telemetry {
  position: Observation<SimulationCoordinate>;
  orientation: Observation<ImuReading>;
  altitude: Observation<number>;
  battery: Observation<number>;
  groundSpeed: Observation<number>;
  heading: Observation<number>;
  missionProgress: Observation<number> | null;
}

export class TelemetryGenerator {
  private readonly gps: Sensor<SimulationCoordinate> = new SimulatedGpsSensor();
  private readonly imu: Sensor<ImuReading> = new SimulatedImuSensor();
  private readonly barometer: Sensor<number> = new SimulatedBarometerSensor();
  private readonly battery: Sensor<number> = new SimulatedBatterySensor();

  generate(state: DroneState): Telemetry {
    return {
      position: this.gps.read(state),
      orientation: this.imu.read(state),
      altitude: this.barometer.read(state),
      battery: this.battery.read(state),
      groundSpeed: createSimulatedObservation({
        type: 'drone.ground_speed',
        value: state.groundSpeed,
        unit: 'm/s',
        timestamp: state.timestamp,
        source: 'simulation-engine'
      }),
      heading: createSimulatedObservation({
        type: 'drone.heading',
        value: state.heading,
        unit: 'deg',
        timestamp: state.timestamp,
        source: 'simulation-engine'
      }),
      missionProgress: state.mission.progress === null
        ? null
        : createSimulatedObservation({
            type: 'mission.progress',
            value: state.mission.progress,
            unit: 'fraction',
            timestamp: state.timestamp,
            source: 'simulation-engine'
          })
    };
  }
}
