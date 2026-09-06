import type { DroneState } from '../drone/DroneState';
import type { Mission } from '../mission/Mission';
import type { Telemetry } from '../telemetry/TelemetryGenerator';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing HUD element #${id}`);
  return node as T;
}

/**
 * Renders Telemetry/DroneState into the DOM. This module never computes a
 * scientific or kinematic value itself — every number here was already
 * produced by the simulation engine and wrapped as an Observation upstream.
 */
export class Hud {
  private readonly refs = {
    loading: el<HTMLDivElement>('loadingScreen'),
    altitude: el<HTMLSpanElement>('altitude'),
    speed: el<HTMLSpanElement>('speed'),
    heading: el<HTMLSpanElement>('heading'),
    pitch: el<HTMLSpanElement>('pitch'),
    roll: el<HTMLSpanElement>('roll'),
    yawRate: el<HTMLSpanElement>('yawRate'),
    compassNeedle: el<HTMLDivElement>('compassNeedle'),
    simX: el<HTMLSpanElement>('simX'),
    simZ: el<HTMLSpanElement>('simZ'),
    batteryFill: el<HTMLDivElement>('batteryFill'),
    batteryVal: el<HTMLSpanElement>('batteryVal'),
    simTime: el<HTMLSpanElement>('simTime'),
    modeText: el<HTMLSpanElement>('modeText'),
    flightStateValue: el<HTMLSpanElement>('flightStateValue'),
    missionProgressPercent: el<HTMLSpanElement>('missionProgressPercent'),
    missionProgressFill: el<HTMLDivElement>('missionProgressFill'),
    missionWaypoint: el<HTMLSpanElement>('missionWaypoint')
  };

  hideLoadingScreen(): void {
    this.refs.loading.classList.add('hidden');
  }

  update(state: DroneState, telemetry: Telemetry, mission: Mission, simSeconds: number): void {
    const r = this.refs;
    r.altitude.textContent = telemetry.altitude.value !== null ? telemetry.altitude.value.toFixed(1) : '—';
    r.speed.textContent = telemetry.groundSpeed.value !== null ? telemetry.groundSpeed.value.toFixed(1) : '—';
    r.heading.textContent = telemetry.heading.value !== null
      ? Math.round(telemetry.heading.value).toString().padStart(3, '0')
      : '—';
    r.pitch.textContent = telemetry.orientation.value !== null ? telemetry.orientation.value.pitch.toFixed(1) : '—';
    r.roll.textContent = telemetry.orientation.value !== null ? telemetry.orientation.value.roll.toFixed(1) : '—';
    r.yawRate.textContent = telemetry.orientation.value !== null ? telemetry.orientation.value.yawRate.toFixed(1) : '—';
    r.compassNeedle.style.transform = `translate(-50%, -50%) rotate(${state.heading}deg)`;

    r.simX.textContent = `${telemetry.position.value?.x.toFixed(2) ?? '—'} m`;
    r.simZ.textContent = `${telemetry.position.value?.z.toFixed(2) ?? '—'} m`;

    const battery = telemetry.battery.value ?? 0;
    r.batteryFill.style.width = `${battery}%`;
    r.batteryVal.textContent = `${Math.round(battery)}%`;

    r.modeText.textContent = state.flightState;
    r.flightStateValue.textContent = state.flightState;

    if (telemetry.missionProgress?.value != null && state.mission.currentWaypointIndex !== null) {
      const percent = Math.round(telemetry.missionProgress.value * 100);
      r.missionProgressPercent.textContent = `${percent}%`;
      r.missionProgressFill.style.width = `${percent}%`;
      r.missionWaypoint.textContent = `${state.mission.currentWaypointIndex + 1} / ${mission.waypoints.length}`;
    } else {
      r.missionProgressPercent.textContent = '—';
      r.missionProgressFill.style.width = '0%';
      r.missionWaypoint.textContent = '—';
    }

    const total = Math.floor(simSeconds);
    const hh = Math.floor(total / 3600).toString().padStart(2, '0');
    const mm = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(total % 60).toString().padStart(2, '0');
    r.simTime.textContent = `${hh}:${mm}:${ss}`;
  }
}

export function setButtonActive(id: string, active: boolean): void {
  const btn = document.getElementById(id);
  if (btn) btn.classList.toggle('active', active);
}
