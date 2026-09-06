import type { FlightState } from '../drone/FlightStateMachine';

/**
 * A deliberately simple, clearly-simulated battery model. It is NOT a
 * physical battery discharge curve — it is a documented linear draw-rate
 * approximation so the number on the HUD has a stated, inspectable
 * assumption behind it instead of an arbitrary decay constant.
 *
 * Assumptions (Phase 1):
 * - Pack capacity is treated as 100 "percent-seconds-equivalent" units.
 * - Draw rate depends only on flight state (a stand-in for thrust demand),
 *   not on wind, payload, or temperature — those are future refinements.
 * - Draw rates are in percent of charge consumed per second of sim time.
 */
const DRAW_RATE_PERCENT_PER_SECOND: Record<FlightState, number> = {
  IDLE: 0.001,
  ARMING: 0.01,
  TAKEOFF: 0.06,
  MISSION: 0.02,
  PAUSED: 0.008,
  RETURN_TO_HOME: 0.03,
  LANDING: 0.02,
  LANDED: 0,
  EMERGENCY: 0.05
};

export const BATTERY_CRITICAL_THRESHOLD_PERCENT = 15;

export class BatteryModel {
  private stateOfCharge: number;

  constructor(initialPercent = 100) {
    this.stateOfCharge = clamp(initialPercent, 0, 100);
  }

  get percent(): number {
    return this.stateOfCharge;
  }

  get critical(): boolean {
    return this.stateOfCharge <= BATTERY_CRITICAL_THRESHOLD_PERCENT;
  }

  /** Advance the model by dtSeconds of simulated time under the given flight state. */
  tick(dtSeconds: number, flightState: FlightState): void {
    const rate = DRAW_RATE_PERCENT_PER_SECOND[flightState];
    this.stateOfCharge = clamp(this.stateOfCharge - rate * dtSeconds, 0, 100);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
