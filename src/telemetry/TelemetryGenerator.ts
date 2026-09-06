import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
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
  readonly gps: Sensor<SimulationCoordinate> = new SimulatedGpsSensor();
  readonly imu: Sensor<ImuReading> = new SimulatedImuSensor();
  readonly barometer: Sensor<number> = new SimulatedBarometerSensor();
  readonly battery: Sensor<number> = new SimulatedBatterySensor();

  /** The sensors backing this generator, for registering matching SensorRecords — see world/demoWorld.ts. */
  get sensors(): ReadonlyArray<Sensor<unknown>> {
    return [this.gps, this.imu, this.barometer, this.battery];
  }

  generate(state: DroneState, context: ObservationContext = {}): Telemetry {
    return {
      position: this.gps.read(state, context),
      orientation: this.imu.read(state, context),
      altitude: this.barometer.read(state, context),
      battery: this.battery.read(state, context),
      groundSpeed: createSimulatedObservation({
        type: 'drone.ground_speed',
        value: state.groundSpeed,
        unit: 'm/s',
        timestamp: state.timestamp,
        source: 'simulation-engine',
        ...context
      }),
      heading: createSimulatedObservation({
        type: 'drone.heading',
        value: state.heading,
        unit: 'deg',
        timestamp: state.timestamp,
        source: 'simulation-engine',
        ...context
      }),
      missionProgress: state.mission.progress === null
        ? null
        : createSimulatedObservation({
            type: 'mission.progress',
            value: state.mission.progress,
            unit: 'fraction',
            timestamp: state.timestamp,
            source: 'simulation-engine',
            ...context
          })
    };
  }
}
