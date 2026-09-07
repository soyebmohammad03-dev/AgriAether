import type { Mission, MissionStatus } from './Mission';

/** Same shape as FlightStateMachine's TRANSITIONS table, at the Mission level rather than the drone's flight state. */
const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  PENDING: ['ACTIVE', 'ABORTED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'ABORTED'],
  PAUSED: ['ACTIVE', 'ABORTED'],
  COMPLETED: [],
  ABORTED: []
};

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

/** Immutable transition, matching this codebase's domain-object convention (Mission/Waypoint are plain data, never classes). */
export function transitionMission(mission: Mission, to: MissionStatus): Mission {
  if (!canTransitionMission(mission.status, to)) {
    throw new Error(`Invalid mission status transition: ${mission.status} -> ${to}`);
  }
  const now = Date.now();
  return {
    ...mission,
    status: to,
    startedAt: to === 'ACTIVE' && mission.startedAt === null ? now : mission.startedAt,
    completedAt: to === 'COMPLETED' || to === 'ABORTED' ? now : mission.completedAt
  };
}

export const startMission = (mission: Mission): Mission => transitionMission(mission, 'ACTIVE');
export const pauseMission = (mission: Mission): Mission => transitionMission(mission, 'PAUSED');
export const resumeMission = (mission: Mission): Mission => transitionMission(mission, 'ACTIVE');
export const abortMission = (mission: Mission): Mission => transitionMission(mission, 'ABORTED');
export const completeMission = (mission: Mission): Mission => transitionMission(mission, 'COMPLETED');
