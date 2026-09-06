import type { AnalysisEvaluation } from '../sensing/AnalysisRegistry';

export type MissionRequirementStatus = 'MISSION_REQUIRED' | 'SUFFICIENT';

export interface MissionDataRequirement {
  analysisId: string;
  analysisName: string;
  status: MissionRequirementStatus;
  required: string[];
  availableSensorKinds: string[];
  reason: string;
}

/**
 * Reframes each sensing/AnalysisRegistry evaluation as a mission-planning
 * question: does the drone need to go collect something before this
 * analysis can run? This does NOT plan or fly a mission — Part 30 of the
 * Phase 5 brief is explicit that this phase only identifies the
 * requirement, nothing more.
 */
export function evaluateMissionDataRequirements(evaluations: readonly AnalysisEvaluation[], availableSensorKinds: readonly string[]): MissionDataRequirement[] {
  return evaluations.map(({ definition, availability, reason }) => ({
    analysisId: definition.id,
    analysisName: definition.name,
    status: availability === 'UNSUPPORTED' ? 'MISSION_REQUIRED' : 'SUFFICIENT',
    required: definition.requiredSensorKinds.length > 0 ? definition.requiredSensorKinds : ['(no specific sensor required)'],
    availableSensorKinds: [...availableSensorKinds],
    reason
  }));
}
