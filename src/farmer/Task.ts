import { createId } from '../domain/id';
import type { Recommendation, RecommendationCategory } from '../sensing/RecommendationEngine';

export type TaskType = 'INSPECT_ZONE' | 'REVIEW_IRRIGATION' | 'COLLECT_SOIL_SAMPLE' | 'REVIEW_VEGETATION_CHANGE' | 'INSPECT_STRESS';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FarmTask {
  id: string;
  type: TaskType;
  fieldId: string;
  zoneId: string | null;
  priority: TaskPriority;
  /** Why this task exists — human-readable, sourced from the triggering recommendation's rationale, never invented. */
  reason: string;
  evidenceObservationIds: string[];
  status: TaskStatus;
  createdAt: number;
  /** e.g. "recommendation:<id>" — always traceable back to what generated this task. */
  provenance: string;
}

const CATEGORY_TASK_TYPE: Record<RecommendationCategory, TaskType> = {
  IRRIGATION: 'REVIEW_IRRIGATION',
  NUTRIENT: 'COLLECT_SOIL_SAMPLE',
  FIELD_OPERATION: 'INSPECT_ZONE'
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['IN_PROGRESS', 'DISMISSED'],
  IN_PROGRESS: ['COMPLETED', 'DISMISSED'],
  COMPLETED: [],
  DISMISSED: []
};

export function transitionTask(task: FarmTask, to: TaskStatus): FarmTask {
  if (!TASK_TRANSITIONS[task.status].includes(to)) {
    throw new Error(`Invalid task status transition: ${task.status} -> ${to}`);
  }
  return { ...task, status: to };
}

/**
 * Turns validated, evidence-backed recommendations (see sensing/
 * RecommendationEngine.ts) into lightweight operational tasks — never
 * fertilizer quantities or pesticide instructions, only an inspection/
 * review/sampling action a farmer can actually do. NEEDS_MORE_DATA
 * recommendations become a data-collection task (soil sample), never a
 * confident action.
 */
export function tasksFromRecommendations(recommendations: readonly Recommendation[]): FarmTask[] {
  return recommendations.map((r) => {
    const type: TaskType = r.status === 'NEEDS_MORE_DATA' ? 'COLLECT_SOIL_SAMPLE' : CATEGORY_TASK_TYPE[r.category];
    return {
      id: createId('task'),
      type,
      fieldId: r.fieldId,
      zoneId: r.zoneId,
      priority: (r.urgency ?? 'LOW') as TaskPriority,
      reason: r.rationale || r.proposedAction,
      evidenceObservationIds: r.evidenceObservationIds,
      status: 'OPEN',
      createdAt: Date.now(),
      provenance: `recommendation:${r.id}`
    };
  });
}
