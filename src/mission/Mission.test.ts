import { describe, expect, it } from 'vitest';
import { createMission, createWaypoint } from './Mission';

describe('createWaypoint', () => {
  it('rejects a negative altitude', () => {
    expect(() =>
      createWaypoint({ id: 'wp', position: { x: 0, y: 0, z: 0 }, altitude: -5, speedTarget: 5 })
    ).toThrow(/negative altitude/);
  });

  it('rejects a non-positive speed target', () => {
    expect(() =>
      createWaypoint({ id: 'wp', position: { x: 0, y: 0, z: 0 }, altitude: 5, speedTarget: 0 })
    ).toThrow(/speed target/);
  });

  it('defaults action to "none"', () => {
    const wp = createWaypoint({ id: 'wp', position: { x: 0, y: 0, z: 0 }, altitude: 5, speedTarget: 5 });
    expect(wp.action).toBe('none');
  });
});

describe('createMission', () => {
  const wp = (id: string) => createWaypoint({ id, position: { x: 0, y: 5, z: 0 }, altitude: 5, speedTarget: 5 });

  it('rejects a mission with fewer than 2 waypoints', () => {
    expect(() => createMission({ id: 'm', name: 'M', waypoints: [wp('a')] })).toThrow(/at least 2 waypoints/);
  });

  it('starts PENDING with no start/completion timestamps', () => {
    const mission = createMission({ id: 'm', name: 'M', waypoints: [wp('a'), wp('b')] });
    expect(mission.status).toBe('PENDING');
    expect(mission.startedAt).toBeNull();
    expect(mission.completedAt).toBeNull();
  });
});
