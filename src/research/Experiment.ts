import { createId } from '../domain/id';
import { assessIrrigationNeed } from '../irrigation/IrrigationIntelligence';
import type { AgriculturalMissionPlan } from '../mission/AgriculturalMission';

/**
 * Marks every value flowing through an experiment so a hypothetical never
 * gets mistaken for something the field actually reported. This vocabulary
 * is deliberately distinct from Observation's Provenance ('MEASURED' etc)
 * — an experiment result is never written back as an Observation, and this
 * type is how a caller can enforce that at compile time.
 */
export type ExperimentDataKind = 'OBSERVED_REAL_DATA' | 'SIMULATED_INPUT' | 'DERIVED_OUTPUT' | 'HYPOTHETICAL_RESULT';

export interface ScenarioChange {
  field: string;
  fromValue: unknown;
  toValue: unknown;
  kind: 'SIMULATED_INPUT';
}

export interface ExperimentResult {
  label: string;
  value: unknown;
  kind: ExperimentDataKind;
}

export interface Experiment {
  id: string;
  name: string;
  fieldId: string;
  baselineKind: ExperimentDataKind;
  baselineSummary: string;
  scenarioChanges: ScenarioChange[];
  assumptions: string[];
  results: ExperimentResult[];
  provenance: string;
  /** How to reproduce this exact result — a deterministic function name plus its inputs, never "re-run and see." */
  reproducibilityNote: string;
  createdAt: number;
}

/**
 * A what-if over IrrigationIntelligence's real rule-based screen — not a
 * new simulation engine. `baseline` should be real evidence (soil moisture,
 * rainfall, events) already gathered for the field; `scenarioOverrides`
 * describes a hypothetical change to compare against it. Both baseline and
 * scenario are run through the exact same production function
 * (assessIrrigationNeed), so the only difference between OBSERVED_REAL_DATA
 * and HYPOTHETICAL_RESULT is the input, never the rule.
 */
export function runIrrigationWhatIf(params: {
  name?: string;
  baseline: Parameters<typeof assessIrrigationNeed>[0];
  scenarioOverrides: Partial<Parameters<typeof assessIrrigationNeed>[0]>;
}): Experiment {
  const baselineResult = assessIrrigationNeed(params.baseline);
  const scenarioInput = { ...params.baseline, ...params.scenarioOverrides };
  const scenarioResult = assessIrrigationNeed(scenarioInput);

  const scenarioChanges: ScenarioChange[] = Object.keys(params.scenarioOverrides).map((key) => ({
    field: key,
    fromValue: (params.baseline as Record<string, unknown>)[key] ?? null,
    toValue: (params.scenarioOverrides as Record<string, unknown>)[key],
    kind: 'SIMULATED_INPUT'
  }));

  return {
    id: createId('experiment'),
    name: params.name ?? 'Irrigation what-if',
    fieldId: params.baseline.fieldId,
    baselineKind: 'OBSERVED_REAL_DATA',
    baselineSummary: `Baseline irrigation need: ${baselineResult.needStatus}.`,
    scenarioChanges,
    assumptions: ['Uses the same rule-based irrigation screen as production (irrigation/IrrigationIntelligence.ts) — no new model, no fabricated water volume.'],
    results: [
      { label: 'baseline.needStatus', value: baselineResult.needStatus, kind: 'DERIVED_OUTPUT' },
      { label: 'scenario.needStatus', value: scenarioResult.needStatus, kind: 'HYPOTHETICAL_RESULT' }
    ],
    provenance: 'what_if_experiment_v1',
    reproducibilityNote: 'Deterministic: assessIrrigationNeed(baseline) and assessIrrigationNeed({...baseline, ...scenarioOverrides}) always reproduce these exact results for the same inputs.',
    createdAt: Date.now()
  };
}

/**
 * Compares two already-planned AgriculturalMissionPlans (see
 * mission/AgriculturalMission.ts) — e.g. two objectives or altitude
 * settings for the same field — side by side. Never plans a new mission
 * itself; both plans must be supplied by the caller.
 */
export function compareMissionPlans(params: { name?: string; fieldId: string; planA: AgriculturalMissionPlan; planB: AgriculturalMissionPlan }): Experiment {
  const scenarioChanges: ScenarioChange[] = [
    { field: 'objective', fromValue: params.planA.objective, toValue: params.planB.objective, kind: 'SIMULATED_INPUT' },
    { field: 'altitudeM', fromValue: params.planA.altitudeM, toValue: params.planB.altitudeM, kind: 'SIMULATED_INPUT' }
  ];

  return {
    id: createId('experiment'),
    name: params.name ?? 'Mission plan comparison',
    fieldId: params.fieldId,
    baselineKind: params.planA.provenance === 'UNAVAILABLE' ? 'HYPOTHETICAL_RESULT' : 'DERIVED_OUTPUT',
    baselineSummary: `Plan A (${params.planA.objective}): ${params.planA.mission ? `${params.planA.mission.waypoints.length} waypoints` : 'not executable'}.`,
    scenarioChanges,
    assumptions: ['Both plans use the same deterministic waypoint planner (mission/AgriculturalMission.ts) — no scoring model, no fabricated efficiency numbers.'],
    results: [
      { label: 'planA.waypointCount', value: params.planA.mission?.waypoints.length ?? 0, kind: 'DERIVED_OUTPUT' },
      { label: 'planA.coverageHectares', value: params.planA.estimatedCoverageHectares, kind: 'DERIVED_OUTPUT' },
      { label: 'planB.waypointCount', value: params.planB.mission?.waypoints.length ?? 0, kind: 'HYPOTHETICAL_RESULT' },
      { label: 'planB.coverageHectares', value: params.planB.estimatedCoverageHectares, kind: 'HYPOTHETICAL_RESULT' }
    ],
    provenance: 'mission_plan_comparison_v1',
    reproducibilityNote: 'Deterministic given the same two AgriculturalMissionPlan inputs — replanning with the same parameters reproduces identical plans.',
    createdAt: Date.now()
  };
}
