import { describe, expect, it } from 'vitest';
import { TelemetryGenerator } from './TelemetryGenerator';
import type { DroneState } from '../drone/DroneState';

function makeState(overrides: Partial<DroneState> = {}): DroneState {
  return {
    timestamp: Date.now(),
    position: { x: 1, y: 8, z: 2 },
    velocity: { x: 1, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    orientation: { pitch: 1, roll: 2, yaw: 90 },
    yawRate: 0.5,
    altitudeAgl: 8,
    groundSpeed: 8.4,
    heading: 90,
    battery: { stateOfCharge: 76, critical: false },
    flightState: 'MISSION',
    mission: { missionId: 'mission_default_survey_loop', currentWaypointIndex: 2, progress: 0.34 },
    ...overrides
  };
}

describe('TelemetryGenerator', () => {
  it('marks every generated observation as SIMULATED, never MEASURED', () => {
    const telemetry = new TelemetryGenerator().generate(makeState());
    const observations = [telemetry.position, telemetry.orientation, telemetry.altitude, telemetry.battery, telemetry.groundSpeed, telemetry.heading];
    for (const obs of observations) {
      expect(obs.provenance).toBe('SIMULATED');
    }
  });

  it('carries mission progress through only when the simulation reports one', () => {
    const active = new TelemetryGenerator().generate(makeState());
    expect(active.missionProgress?.value).toBeCloseTo(0.34);

    const idle = new TelemetryGenerator().generate(
      makeState({ flightState: 'IDLE', mission: { missionId: 'mission_default_survey_loop', currentWaypointIndex: null, progress: null } })
    );
    expect(idle.missionProgress).toBeNull();
  });
});
