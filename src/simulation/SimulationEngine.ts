import * as THREE from 'three';
import type { Mission } from '../mission/Mission';
import type { DroneState } from '../drone/DroneState';
import { FlightStateMachine, type FlightState } from '../drone/FlightStateMachine';
import { BatteryModel } from './BatteryModel';

const TAKEOFF_DURATION_SECONDS = 2.5;
const ARMING_DURATION_SECONDS = 1.2;

/**
 * Owns the drone's simulated flight. This is the only place that advances
 * position/velocity/orientation and the flight-state machine each tick — the
 * renderer reads DroneState from here, it never computes it.
 *
 * Auto-sequencing (IDLE -> ARMING -> TAKEOFF -> MISSION) is a Phase 1
 * convenience so the demo has something to show without a mission-control
 * UI yet. It is not autonomous decision-making.
 */
export class SimulationEngine {
  private readonly mission: Mission;
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly stateMachine = new FlightStateMachine('IDLE');
  private readonly battery = new BatteryModel(100);

  private elapsedInState = 0;
  private missionU = 0;
  private lastPosition: THREE.Vector3;
  private lastHeadingDeg = 0;
  private simTime = 0;

  constructor(mission: Mission) {
    this.mission = mission;
    const points = mission.waypoints.map((wp) => new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z));
    this.curve = new THREE.CatmullRomCurve3(points, mission.loop, 'catmullrom', 0.18);
    this.lastPosition = this.curve.getPointAt(0);
  }

  start(): void {
    if (this.stateMachine.current === 'IDLE') {
      this.stateMachine.transition('ARMING');
      this.mission.status = 'ACTIVE';
      this.mission.startedAt = Date.now();
    }
  }

  setPaused(paused: boolean): void {
    const current = this.stateMachine.current;
    if (paused && current === 'MISSION') {
      this.stateMachine.transition('PAUSED');
      this.mission.status = 'PAUSED';
    } else if (!paused && current === 'PAUSED') {
      this.stateMachine.transition('MISSION');
      this.mission.status = 'ACTIVE';
    }
  }

  get flightState(): FlightState {
    return this.stateMachine.current;
  }

  /** Advance the simulation by dtSeconds and return the resulting DroneState. */
  tick(dtSeconds: number): DroneState {
    this.simTime += dtSeconds;
    this.elapsedInState += dtSeconds;
    this.advanceFlightState();
    this.battery.tick(dtSeconds, this.stateMachine.current);

    const moving = this.stateMachine.current === 'MISSION' || this.stateMachine.current === 'TAKEOFF';
    if (moving) {
      this.missionU = (this.missionU + dtSeconds * 0.018) % 1;
    }

    const position = this.curve.getPointAt(this.missionU);
    const lookahead = this.curve.getPointAt((this.missionU + 0.006) % 1);
    const forward = lookahead.clone().sub(position);
    const horizontalForward = new THREE.Vector2(forward.x, forward.z);
    const headingDeg = horizontalForward.lengthSq() > 1e-6
      ? ((Math.atan2(forward.x, forward.z) * 180) / Math.PI + 360) % 360
      : this.lastHeadingDeg;

    const velocity = dtSeconds > 0
      ? position.clone().sub(this.lastPosition).divideScalar(dtSeconds)
      : new THREE.Vector3();
    const groundSpeed = Math.hypot(velocity.x, velocity.z);

    let yawRate = 0;
    if (dtSeconds > 0) {
      let delta = headingDeg - this.lastHeadingDeg;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      yawRate = delta / dtSeconds;
    }

    const state: DroneState = {
      timestamp: Date.now(),
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      acceleration: { x: 0, y: 0, z: 0 }, // not modeled in Phase 1 — velocity is direct kinematic sampling
      orientation: {
        pitch: moving ? Math.sin(this.simTime * 1.3) * 3.8 : 0,
        roll: moving ? Math.sin(this.simTime * 1.9) * 5.2 : 0,
        yaw: headingDeg
      },
      yawRate,
      altitudeAgl: position.y,
      groundSpeed,
      heading: headingDeg,
      battery: {
        stateOfCharge: this.battery.percent,
        critical: this.battery.critical
      },
      flightState: this.stateMachine.current,
      mission: this.currentMissionState()
    };

    this.lastPosition = position;
    this.lastHeadingDeg = headingDeg;
    return state;
  }

  private advanceFlightState(): void {
    const current = this.stateMachine.current;
    if (current === 'ARMING' && this.elapsedInState >= ARMING_DURATION_SECONDS) {
      this.stateMachine.transition('TAKEOFF');
      this.elapsedInState = 0;
    } else if (current === 'TAKEOFF' && this.elapsedInState >= TAKEOFF_DURATION_SECONDS) {
      this.stateMachine.transition('MISSION');
      this.elapsedInState = 0;
    }
  }

  private currentMissionState(): DroneState['mission'] {
    const total = this.mission.waypoints.length;
    const active = this.stateMachine.current === 'MISSION' || this.stateMachine.current === 'PAUSED';
    if (!active || total === 0) {
      return { missionId: this.mission.id, currentWaypointIndex: null, progress: null };
    }
    const currentWaypointIndex = Math.floor(this.missionU * total) % total;
    return {
      missionId: this.mission.id,
      currentWaypointIndex,
      progress: this.missionU
    };
  }
}
