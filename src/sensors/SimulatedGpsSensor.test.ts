import { describe, expect, it } from 'vitest';
import { SimulatedGpsSensor } from './SimulatedGpsSensor';
import type { DroneState } from '../drone/DroneState';

function makeState(timestamp: number, x: number, z: number): DroneState {
  return {
    timestamp,
    position: { x, y: 8, z },
    velocity: { x: 0, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    orientation: { pitch: 0, roll: 0, yaw: 0 },
    yawRate: 0,
    altitudeAgl: 8,
    groundSpeed: 0,
    heading: 0,
    battery: { stateOfCharge: 100, critical: false },
    flightState: 'MISSION',
    mission: { missionId: null, currentWaypointIndex: null, progress: null }
  };
}

describe('SimulatedGpsSensor', () => {
  it('always returns a SIMULATED observation for its declared capability', () => {
    const sensor = new SimulatedGpsSensor();
    const obs = sensor.read(makeState(0, 0, 0));
    expect(obs.provenance).toBe('SIMULATED');
    expect(obs.type).toBe('drone.position.local');
    expect(sensor.capabilities).toContain(obs.type);
  });

  it('holds its reading between update-interval ticks (simulated 5Hz update rate)', () => {
    const sensor = new SimulatedGpsSensor();
    const first = sensor.read(makeState(0, 10, 10));
    const second = sensor.read(makeState(50, 20, 20)); // 50ms later, inside the 200ms interval
    expect(second.timestamp).toBe(first.timestamp);
    expect(second.value).toEqual(first.value);
  });

  it('resamples once the update interval has elapsed', () => {
    const sensor = new SimulatedGpsSensor();
    const first = sensor.read(makeState(0, 10, 10));
    const second = sensor.read(makeState(250, 20, 20)); // past the 200ms interval
    expect(second.timestamp).toBe(250);
    expect(second.timestamp).not.toBe(first.timestamp);
  });

  it('attaches provided domain context onto the observation', () => {
    const sensor = new SimulatedGpsSensor();
    const obs = sensor.read(makeState(0, 0, 0), { fieldId: 'field_1', droneId: 'drone_1' });
    expect(obs.fieldId).toBe('field_1');
    expect(obs.droneId).toBe('drone_1');
    expect(obs.sensorId).toBe(sensor.id);
  });
});
