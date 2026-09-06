import { describe, expect, it } from 'vitest';
import { FlightStateMachine } from './FlightStateMachine';

describe('FlightStateMachine', () => {
  it('starts IDLE and follows the arming sequence', () => {
    const fsm = new FlightStateMachine();
    expect(fsm.current).toBe('IDLE');
    fsm.transition('ARMING');
    fsm.transition('TAKEOFF');
    fsm.transition('MISSION');
    expect(fsm.current).toBe('MISSION');
  });

  it('rejects a drone jumping straight from LANDED to MISSION', () => {
    const fsm = new FlightStateMachine('LANDED');
    expect(() => fsm.transition('MISSION')).toThrow(/Invalid flight state transition/);
  });

  it('allows any state to transition to EMERGENCY', () => {
    const states = ['IDLE', 'ARMING', 'TAKEOFF', 'MISSION', 'PAUSED', 'RETURN_TO_HOME', 'LANDING'] as const;
    for (const state of states) {
      const fsm = new FlightStateMachine(state);
      expect(() => fsm.transition('EMERGENCY')).not.toThrow();
    }
  });

  it('requires EMERGENCY to land before re-arming', () => {
    const fsm = new FlightStateMachine('EMERGENCY');
    expect(() => fsm.transition('ARMING')).toThrow();
    fsm.transition('LANDED');
    expect(() => fsm.transition('ARMING')).not.toThrow();
  });
});
