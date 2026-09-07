import type { MissionDecision } from '../drone/AutonomyEngine';
import type { FleetDrone, AssignmentResult } from '../fleet/Fleet';
import type { ConnectionState, HardwareProvenance } from '../hardware/HardwareInterface';
import { escapeHtml as esc } from './escapeHtml';

export interface OperationsViewModel {
  decision: MissionDecision;
  fleetDrone: FleetDrone;
  assignment: AssignmentResult;
  flightController: { id: string; connectionState: ConnectionState; provenance: HardwareProvenance };
}

/**
 * Compact autonomous-operations view: mission decision/plan/validation,
 * the one simulated drone's fleet state, assignment outcome, and the
 * simulated flight controller's connection state. Every "no mission today"
 * or "not assigned" case is shown as the real reason from
 * AutonomyEngine/Fleet, never hidden or replaced with a placeholder.
 * Closed by default, following TwinPanel/DataCatalogPanel.
 */
export class OperationsPanel {
  private readonly panel = document.getElementById('operationsPanel');
  private readonly content = document.getElementById('operationsContent');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(vm: OperationsViewModel): void {
    if (!this.content) return;

    const { decision, fleetDrone, assignment, flightController } = vm;

    const decisionRows = [
      `<div class="catalog-kv"><span>Objective</span><span>${decision.objective}</span></div>`,
      `<div class="catalog-kv"><span>Triggered by</span><span>${decision.triggeringRecommendationId ?? 'none — routine survey'}</span></div>`,
      `<div class="catalog-dataset">${esc(decision.rationale)}</div>`
    ].join('');

    const planRows = decision.plan.mission
      ? [
          `<div class="catalog-kv"><span>Waypoints</span><span>${decision.plan.mission.waypoints.length}</span></div>`,
          `<div class="catalog-kv"><span>Altitude</span><span>${decision.plan.altitudeM}m</span></div>`,
          `<div class="catalog-kv"><span>Coverage</span><span>${decision.plan.estimatedCoverageHectares?.toFixed(3) ?? 'n/a'}ha</span></div>`,
          `<div class="catalog-kv"><span>Provenance</span><span>${decision.plan.provenance}</span></div>`
        ].join('')
      : `<div class="catalog-muted">No executable mission — ${decision.plan.provenance}.</div>`;

    const requirementRows = `<div class="catalog-kv"><span>Required sensors</span><span>${decision.plan.requiredSensorKinds.join(', ')}</span></div>`;

    const limitationRows = decision.plan.limitations.length
      ? decision.plan.limitations.map((l) => `<div class="catalog-gap">${l}</div>`).join('')
      : '<div class="catalog-muted">No planning limitations.</div>';

    const validationRows = [
      `<div class="catalog-kv"><span>Valid</span><span class="${decision.validation.valid ? 'catalog-ok' : 'catalog-gap'}">${decision.validation.valid}</span></div>`,
      ...decision.validation.errors.map((e) => `<div class="catalog-gap">ERROR: ${e}</div>`),
      ...decision.validation.warnings.map((w) => `<div class="catalog-muted">WARNING: ${w}</div>`)
    ].join('');

    const fleetRows = [
      `<div class="catalog-kv"><span>${esc(fleetDrone.name)}</span><span>${fleetDrone.status} (${fleetDrone.provenance})</span></div>`,
      `<div class="catalog-kv"><span>Capabilities</span><span>${fleetDrone.capabilities.join(', ') || 'none'}</span></div>`,
      `<div class="catalog-kv"><span>Battery</span><span>${fleetDrone.batteryStateOfCharge !== null ? `${fleetDrone.batteryStateOfCharge.toFixed(0)}%` : 'n/a'}</span></div>`
    ].join('');

    const assignmentRows = assignment.assignedDroneId
      ? `<div class="catalog-kv"><span>Assigned</span><span class="catalog-ok">${assignment.assignedDroneId}</span></div>`
      : `<div class="catalog-muted">Not assigned — ${assignment.reason}.</div>`;

    const hardwareRows = `<div class="catalog-kv"><span>${flightController.id}</span><span>${flightController.connectionState} (${flightController.provenance})</span></div>`;

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Mission Decision</h4>${decisionRows}</div>`,
      `<div class="catalog-section"><h4>Mission Plan</h4>${planRows}${requirementRows}</div>`,
      `<div class="catalog-section"><h4>Planning Limitations</h4>${limitationRows}</div>`,
      `<div class="catalog-section"><h4>Safety Validation</h4>${validationRows}</div>`,
      `<div class="catalog-section"><h4>Fleet State</h4>${fleetRows}</div>`,
      `<div class="catalog-section"><h4>Assignment</h4>${assignmentRows}</div>`,
      `<div class="catalog-section"><h4>Hardware — Flight Controller</h4>${hardwareRows}</div>`
    ].join('');
  }
}
