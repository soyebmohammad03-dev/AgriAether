import type { DroneState } from '../drone/DroneState';
import type { Observation, ObservationContext } from '../observation/Observation';

export type SensorPlatform = 'drone' | 'ground' | 'fixed-station' | 'mobile' | 'external';

/**
 * The one contract every sensor implements, real or simulated. A future
 * hardware-backed sensor (e.g. a real GPS receiver over a serial gateway)
 * implements the same interface so the telemetry pipeline downstream never
 * needs to know which kind of sensor it is reading.
 *
 * Phase 1 only implements Sensor<DroneState> readers (drone-platform,
 * simulated). Ground/fixed-station/mobile/external sensors are represented
 * here as platform values the interface already supports, not as concrete
 * implementations — see the Phase 0 audit, §15.
 *
 * `context` lets the caller attach domain linkage (farmId/fieldId/missionId/
 * droneId — see domain/SensorRecord.ts and world/WorldRegistry.ts) without
 * the sensor itself needing to know about Farms or Fields.
 */
export interface Sensor<TValue> {
  id: string;
  kind: string;
  platform: SensorPlatform;
  isSimulated: boolean;
  /** Dot-namespaced Observation types this sensor is allowed to produce — see domain/SensorRecord.ts. */
  capabilities: readonly string[];
  read(input: DroneState, context?: ObservationContext): Observation<TValue>;
}

/**
 * Guards against a sensor producing an Observation type it never declared
 * capability for — the mechanism that keeps "RGB camera -> soil NPK"-style
 * claims impossible without an explicit, separately-validated estimation
 * model performing that transformation.
 */
export function assertSensorCapable(sensor: Pick<Sensor<unknown>, 'id' | 'capabilities'>, observationType: string): void {
  if (!sensor.capabilities.includes(observationType)) {
    throw new Error(
      `Sensor "${sensor.id}" attempted to produce observation type "${observationType}" but only declares capabilities: ${sensor.capabilities.join(', ')}`
    );
  }
}
