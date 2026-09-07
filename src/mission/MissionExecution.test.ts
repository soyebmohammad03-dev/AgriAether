import { describe, expect, it } from 'vitest';
import { createMission, createWaypoint } from './Mission';
import { startMission, pauseMission, resumeMission, abortMission, transitionMission } from './MissionExecution';

function baseMission() {
  return createMission({
    id: 'm1',
    name: 'test',
    waypoints: [
      createWaypoint({ id: 'w1', position: { x: 0, y: 10, z: 0 }, altitude: 10, speedTarget: 1 }),
      createWaypoint({ id: 'w2', position: { x: 10, y: 10, z: 0 }, altitude: 10, speedTarget: 1 })
    ]
  });
}

describe('mission execution transitions', () => {
  it('supports the full start -> pause -> resume -> abort lifecycle', () => {
    let mission = baseMission();
    expect(mission.status).toBe('PENDING');
    mission = startMission(mission);
    expect(mission.status).toBe('ACTIVE');
    expect(mission.startedAt).not.toBeNull();
    mission = pauseMission(mission);
    expect(mission.status).toBe('PAUSED');
    mission = resumeMission(mission);
    expect(mission.status).toBe('ACTIVE');
    mission = abortMission(mission);
    expect(mission.status).toBe('ABORTED');
    expect(mission.completedAt).not.toBeNull();
  });

  it('rejects an invalid transition rather than silently applying it', () => {
    const mission = baseMission();
    expect(() => transitionMission(mission, 'COMPLETED')).toThrow(/Invalid mission status transition/);
  });

  it('a COMPLETED mission cannot transition further', () => {
    let mission = startMission(baseMission());
    mission = transitionMission(mission, 'COMPLETED');
    expect(() => transitionMission(mission, 'ACTIVE')).toThrow();
  });
});
