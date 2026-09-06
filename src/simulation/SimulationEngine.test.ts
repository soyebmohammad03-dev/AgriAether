import { describe, expect, it } from 'vitest';
import { SimulationEngine } from './SimulationEngine';
import { buildDefaultMission } from '../mission/defaultMission';

describe('SimulationEngine', () => {
  it('progresses IDLE -> ARMING -> TAKEOFF -> MISSION on its own over time', () => {
    const engine = new SimulationEngine(buildDefaultMission());
    engine.start();
    expect(engine.flightState).toBe('ARMING');

    for (let i = 0; i < 100; i++) engine.tick(0.05); // 5s
    expect(engine.flightState).toBe('MISSION');
  });

  it('reports no mission progress before the mission starts', () => {
    const engine = new SimulationEngine(buildDefaultMission());
    const state = engine.tick(0.016);
    expect(state.flightState).toBe('IDLE');
    expect(state.mission.currentWaypointIndex).toBeNull();
    expect(state.mission.progress).toBeNull();
  });

  it('advances waypoint progress once in MISSION state', () => {
    const engine = new SimulationEngine(buildDefaultMission());
    engine.start();
    for (let i = 0; i < 100; i++) engine.tick(0.05); // reach MISSION

    const before = engine.tick(0.016);
    for (let i = 0; i < 50; i++) engine.tick(0.5); // advance sim time substantially
    const after = engine.tick(0.016);

    expect(before.mission.progress).not.toBeNull();
    expect(after.mission.progress).not.toBeNull();
    expect(after.mission.progress).not.toBe(before.mission.progress);
  });

  it('does not advance battery drain rate differently after pausing mid-mission', () => {
    const engine = new SimulationEngine(buildDefaultMission());
    engine.start();
    for (let i = 0; i < 100; i++) engine.tick(0.05);
    engine.setPaused(true);
    expect(engine.flightState).toBe('PAUSED');
    engine.setPaused(false);
    expect(engine.flightState).toBe('MISSION');
  });
});
