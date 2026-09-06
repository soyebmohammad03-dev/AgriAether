import type { DroneState } from '../drone/DroneState';
import { createSimulatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
import { assertSensorCapable, type Sensor } from './Sensor';

const OBSERVATION_TYPE = 'drone.altitude.agl';
/** Standard atmosphere sea-level pressure, Pa. Field elevation is assumed to be sea level for this demo — an assumption, not a measurement. */
const SEA_LEVEL_PRESSURE_PA = 101325;
/** Synthetic pressure-sensor noise, Pa — a stand-in for a real MEMS barometer's error band. */
const PRESSURE_NOISE_PA = 15;

/** International Standard Atmosphere barometric formula (troposphere). */
function altitudeToPressure(altitudeMeters: number): number {
  return SEA_LEVEL_PRESSURE_PA * Math.pow(1 - 2.25577e-5 * altitudeMeters, 5.25588);
}

function pressureToAltitude(pressurePa: number): number {
  return (1 - Math.pow(pressurePa / SEA_LEVEL_PRESSURE_PA, 1 / 5.25588)) / 2.25577e-5;
}

/**
 * Rather than reading the drone's true altitude directly, this models what
 * a real barometric altimeter actually does: convert altitude to an
 * expected air pressure (standard-atmosphere formula), add sensor noise,
 * then invert the formula back to an altitude estimate. The result is
 * therefore an approximation with a stated error source, not a perfect
 * readout — closer to how a real barometer behaves than a direct position
 * read would be.
 */
export class SimulatedBarometerSensor implements Sensor<number> {
  id = 'sim-baro-1';
  kind = 'barometer';
  platform = 'drone' as const;
  isSimulated = true;
  capabilities = [OBSERVATION_TYPE] as const;

  read(state: DroneState, context: ObservationContext = {}): Observation<number> {
    const truePressure = altitudeToPressure(state.altitudeAgl);
    const noisyPressure = truePressure + (Math.random() - 0.5) * 2 * PRESSURE_NOISE_PA;
    const estimatedAltitude = pressureToAltitude(noisyPressure);

    assertSensorCapable(this, OBSERVATION_TYPE);
    return createSimulatedObservation<number>({
      type: OBSERVATION_TYPE,
      value: estimatedAltitude,
      unit: 'm',
      timestamp: state.timestamp,
      location: { frame: 'simulation-local', ...state.position },
      source: 'sim-sensor:barometer',
      confidence: 0.88,
      metadata: { assumedFieldElevationMsl: 0, model: 'ISA-troposphere' },
      ...context,
      sensorId: this.id
    });
  }
}
