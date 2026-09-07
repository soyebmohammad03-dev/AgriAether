import { createId } from '../domain/id';
import type { VerificationState } from '../community/CommunityContribution';

export interface ResearchProject {
  id: string;
  name: string;
  description: string;
  fieldIds: string[];
  experimentIds: string[];
  datasetIds: string[];
  modelIds: string[];
  findingIds: string[];
  createdAt: number;
}

/**
 * A claim about what an experiment/dataset showed — reuses the same
 * UNVERIFIED/REVIEWED/REJECTED vocabulary as CommunityContribution rather
 * than inventing a parallel review system. A finding starts UNVERIFIED and
 * is never treated as settled science by anything else in this codebase —
 * no automatic promotion into a Recommendation, Twin state, or citation
 * exists. `evidenceObservationIds`/`supportingExperimentIds` must point at
 * real records; this module fabricates neither.
 */
export interface ResearchFinding {
  id: string;
  projectId: string;
  summary: string;
  evidenceObservationIds: string[];
  supportingExperimentIds: string[];
  verification: VerificationState;
  provenance: string;
  createdAt: number;
}

export function createResearchProject(params: { name: string; description: string; fieldIds?: string[] }): ResearchProject {
  if (!params.name.trim()) {
    throw new Error('ResearchProject requires a non-empty name');
  }
  return {
    id: createId('research_project'),
    name: params.name,
    description: params.description,
    fieldIds: params.fieldIds ?? [],
    experimentIds: [],
    datasetIds: [],
    modelIds: [],
    findingIds: [],
    createdAt: Date.now()
  };
}

export function createResearchFinding(params: {
  projectId: string;
  summary: string;
  evidenceObservationIds?: string[];
  supportingExperimentIds?: string[];
  provenance: string;
}): ResearchFinding {
  if (!params.summary.trim()) {
    throw new Error('ResearchFinding requires a non-empty summary');
  }
  return {
    id: createId('research_finding'),
    projectId: params.projectId,
    summary: params.summary,
    evidenceObservationIds: params.evidenceObservationIds ?? [],
    supportingExperimentIds: params.supportingExperimentIds ?? [],
    verification: 'UNVERIFIED',
    provenance: params.provenance,
    createdAt: Date.now()
  };
}
