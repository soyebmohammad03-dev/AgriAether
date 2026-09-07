import type { AgriculturalMissionPlan } from './AgriculturalMission';
import { diagnostics } from '../diagnostics/Diagnostics';

export interface MissionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * The one gate every planned mission must pass before it can be assigned to
 * a drone. Safety/constraint failures (no executable waypoint path, a
 * required sensor the assigned drone doesn't have) are errors that block
 * execution outright — they are never downgraded to a warning just because
 * a mission would otherwise be "ready." `plan.limitations` (altitude/speed/
 * geometry caveats already surfaced by the planner) are carried through as
 * warnings when the plan is otherwise valid.
 */
export function validateMissionPlan(plan: AgriculturalMissionPlan, availableSensorKinds: readonly string[]): MissionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [...plan.limitations];

  if (!plan.mission) {
    errors.push('No executable mission was generated for this plan — see limitations for why.');
  }

  const missingSensors = plan.requiredSensorKinds.filter((k) => !availableSensorKinds.includes(k));
  if (missingSensors.length > 0) {
    errors.push(`Required sensor kind(s) not available to fly this mission: ${missingSensors.join(', ')}.`);
  }

  if (errors.length > 0) {
    diagnostics.log({
      severity: 'WARN',
      category: 'MISSION',
      operation: 'validateMissionPlan',
      message: `Mission plan ${plan.id} for field ${plan.fieldId} failed safety validation: ${errors.join(' ')}`,
      correlationId: plan.id,
      detail: { objective: plan.objective, errorCount: errors.length }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
