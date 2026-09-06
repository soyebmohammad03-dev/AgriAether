/**
 * Explicit flight state, replacing the original demo's implicit "always
 * flying" animation. Phase 1 does not implement autonomous emergency
 * behavior — EMERGENCY and RETURN_TO_HOME exist as reachable states so the
 * rest of the system (UI, battery model) has something real to key off of,
 * not as a claim that autonomous safety logic is implemented yet.
 */

export type FlightState =
  | 'IDLE'
  | 'ARMING'
  | 'TAKEOFF'
  | 'MISSION'
  | 'PAUSED'
  | 'RETURN_TO_HOME'
  | 'LANDING'
  | 'LANDED'
  | 'EMERGENCY';

const TRANSITIONS: Record<FlightState, FlightState[]> = {
  IDLE: ['ARMING', 'EMERGENCY'],
  ARMING: ['TAKEOFF', 'IDLE', 'EMERGENCY'],
  TAKEOFF: ['MISSION', 'EMERGENCY'],
  MISSION: ['PAUSED', 'RETURN_TO_HOME', 'EMERGENCY'],
  PAUSED: ['MISSION', 'RETURN_TO_HOME', 'EMERGENCY'],
  RETURN_TO_HOME: ['LANDING', 'EMERGENCY'],
  LANDING: ['LANDED', 'EMERGENCY'],
  LANDED: ['ARMING'],
  EMERGENCY: ['LANDED']
};

export function canTransition(from: FlightState, to: FlightState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class FlightStateMachine {
  private state: FlightState;

  constructor(initial: FlightState = 'IDLE') {
    this.state = initial;
  }

  get current(): FlightState {
    return this.state;
  }

  transition(to: FlightState): void {
    if (!canTransition(this.state, to)) {
      throw new Error(`Invalid flight state transition: ${this.state} -> ${to}`);
    }
    this.state = to;
  }
}
