import type { DroneState } from '../drone/DroneState';
import type { Observation } from '../observation/Observation';

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
 */
export interface Sensor<TValue> {
  id: string;
  kind: string;
  platform: SensorPlatform;
  isSimulated: boolean;
  read(input: DroneState): Observation<TValue>;
}
